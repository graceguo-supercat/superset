# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=too-few-public-methods

import json
import logging
from urllib.parse import quote_plus
from urllib import request
from urllib.error import URLError

from celery.utils.log import get_task_logger
from sqlalchemy import and_, func
from typing import Any, cast, Dict, List, Optional, Union

from superset import app, db
from superset.extensions import celery_app
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.tags import Tag, TaggedObject
from superset.utils.core import parse_human_datetime

import superset.models.core as models

logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


def get_form_data(chart_id, dashboard=None):
    """
    Build `form_data` for chart GET request from dashboard's `default_filters`.

    When a dashboard has `default_filters` they need to be added  as extra
    filters in the GET request for charts.

    """
    form_data = {"slice_id": chart_id}

    if dashboard is None or not dashboard.json_metadata:
        return form_data

    json_metadata = json.loads(dashboard.json_metadata)

    # do not apply filters if chart is immune to them
    if chart_id in json_metadata.get("filter_immune_slices", []):
        return form_data

    default_filters = json.loads(json_metadata.get("default_filters", "null"))
    if not default_filters:
        return form_data

    # are some of the fields in the chart immune to filters?
    filter_immune_slice_fields = json_metadata.get("filter_immune_slice_fields", {})
    immune_fields = filter_immune_slice_fields.get(str(chart_id), [])

    extra_filters = []
    for filters in default_filters.values():
        for col, val in filters.items():
            if col not in immune_fields:
                extra_filters.append({"col": col, "op": "in", "val": val})
    if extra_filters:
        form_data["extra_filters"] = extra_filters

    return form_data


def get_url(chart):
    """Return external URL for warming up a given chart/table cache."""
    with app.test_request_context():
        baseurl = (
            "{SUPERSET_WEBSERVER_PROTOCOL}://"
            "{SUPERSET_WEBSERVER_ADDRESS}:"
            "{SUPERSET_WEBSERVER_PORT}".format(**app.config)
        )
        return f"{baseurl}{chart.url}"


class Strategy:
    """
    A cache warm up strategy.

    Each strategy defines a `get_urls` method that returns a list of URLs to
    be fetched from the `/superset/warm_up_cache/` endpoint.

    Strategies can be configured in `superset/config.py`:

        CELERYBEAT_SCHEDULE = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'top_n_dashboards',
                    'top_n': 10,
                    'since': '7 days ago',
                },
            },
        }

    """

    def __init__(self):
        pass

    def get_urls(self):
        raise NotImplementedError("Subclasses must implement get_urls!")


class DummyStrategy(Strategy):
    """
    Warm up all charts.

    This is a dummy strategy that will fetch all charts. Can be configured by:

        CELERYBEAT_SCHEDULE = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {'strategy_name': 'dummy'},
            },
        }

    """

    name = "dummy"

    def get_urls(self):
        session = db.create_scoped_session()
        charts = session.query(Slice).all()

        return [get_url(chart) for chart in charts]


class TopNDashboardsStrategy(Strategy):
    """
    Warm up charts in the top-n dashboards.

        CELERYBEAT_SCHEDULE = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'top_n_dashboards',
                    'top_n': 5,
                    'since': '7 days ago',
                },
            },
        }

    """

    name = "top_n_dashboards"

    def __init__(self, top_n=5, since="7 days ago"):
        super(TopNDashboardsStrategy, self).__init__()
        self.top_n = top_n
        self.since = parse_human_datetime(since)

    def get_urls(self):
        urls = []
        session = db.create_scoped_session()

        records = (
            session.query(Log.dashboard_id, func.count(Log.dashboard_id))
            .filter(and_(Log.dashboard_id.isnot(None), Log.dttm >= self.since))
            .group_by(Log.dashboard_id)
            .order_by(func.count(Log.dashboard_id).desc())
            .limit(self.top_n)
            .all()
        )
        dash_ids = [record.dashboard_id for record in records]
        dashboards = session.query(Dashboard).filter(Dashboard.id.in_(dash_ids)).all()
        for dashboard in dashboards:
            for chart in dashboard.slices:
                urls.append(get_url(chart))

        return urls


class DashboardTagsStrategy(Strategy):
    """
    Warm up charts in dashboards with custom tags.

        CELERYBEAT_SCHEDULE = {
            'cache-warmup-hourly': {
                'task': 'cache-warmup',
                'schedule': crontab(minute=1, hour='*'),  # @hourly
                'kwargs': {
                    'strategy_name': 'dashboard_tags',
                    'tags': ['core', 'warmup'],
                },
            },
        }
    """

    name = "dashboard_tags"

    def __init__(self, tags=None):
        super(DashboardTagsStrategy, self).__init__()
        self.tags = tags or []

    def get_urls(self):
        urls = []
        session = db.create_scoped_session()

        tags = session.query(Tag).filter(Tag.name.in_(self.tags)).all()
        tag_ids = [tag.id for tag in tags]

        # add dashboards that are tagged
        tagged_objects = (
            session.query(TaggedObject)
            .filter(
                and_(
                    TaggedObject.object_type == "dashboard",
                    TaggedObject.tag_id.in_(tag_ids),
                )
            )
            .all()
        )
        dash_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_dashboards = session.query(Dashboard).filter(Dashboard.id.in_(dash_ids))
        for dashboard in tagged_dashboards:
            for chart in dashboard.slices:
                urls.append(get_url(chart))

        # add charts that are tagged
        tagged_objects = (
            session.query(TaggedObject)
            .filter(
                and_(
                    TaggedObject.object_type == "chart",
                    TaggedObject.tag_id.in_(tag_ids),
                )
            )
            .all()
        )
        chart_ids = [tagged_object.object_id for tagged_object in tagged_objects]
        tagged_charts = session.query(Slice).filter(Slice.id.in_(chart_ids))
        for chart in tagged_charts:
            urls.append(get_url(chart))

        return urls


class DashboardTableStrategy(Strategy):
    name = "dashboard_tables"

    def __init__(self, dashboard_ids=None):
        super(DashboardTableStrategy, self).__init__()
        self.dashboard_ids = dashboard_ids or []

    def get_urls(self):
        urls = []
        session = db.create_scoped_session()

        # find tables for all the dash needs to be warmed
        # build map: { datasource_name: slices }
        # this should run once a day
        dashboard_ids = [12013,
9462,
9454,
1945,
5429,
11395,
8970,
7224,
10611,
10835,
10694,
9648,
11469,
11610,
7337,
12353,
10916,
5559,
11412,
8050,
7281,
2854,
7645,
10002,
6522,
11682,
11952,
11120,
9387,
4887,
12035,
12425,
10735,
12580,
7226,
6421,
12592,
11799,
12637,
11191,
12641,
9076,
11601,
12149,
12478,
8157,
11535,
12578,
11413,
12523,
11326,
3376,
11201,
6139,
9834,
11288,
12192,
1545,
3211,
12387,
11788,
7725,
6630,
11212,
11580,
12412,
11385,
10311,
8721,
8683,
7670,
3064,
7568,
8063,
8435,
11963,
6978,
5849,
8707,
9468,
4430,
12515,
5616,
2261,
10211,
6208,
4743,
9778,
12237,
3115,
10380,
12384,
11408,
12390,
12386,
4752,
6484,
10754,
12445,
11560]
        to_warmup_by_datasource: Dict[str, Dict] = {}
        for dashboard_id in dashboard_ids: #self.dashboard_ids:
            dashboard = session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()
            if dashboard:
                slices = dashboard.slices
                for slc in slices:
                    datasource_type = slc.datasource_type
                    datasource_name = slc.datasource_name
                    if datasource_type == "table" and datasource_name != "minerva.all":
                        to_warmup_by_datasource[datasource_name] = to_warmup_by_datasource.get(datasource_name, {
                            "slice_ids": [],
                            "is_available": False,
                        })
                        to_warmup_by_datasource[datasource_name]["slice_ids"].append(slc.id)
        print('to_warmup:{}'.format(json.dumps(to_warmup_by_datasource)))

        # scan latest partition by datasource
        # this should run multiple times a day
        mydb = session.query(models.Database).filter_by(id=108).one()
        for (datasource_name, value) in to_warmup_by_datasource.items():
            # schema = "superset"
            # table_name = "dashboard_performance_logging"
            # @expose("/extra_table_metadata/<database_id>/<table_name>/<schema>/")
            parts = datasource_name.split('.')
            if len(parts) == 2 and len(parts[1].split()) == 1 and parts[0] != "null":
                try:
                    data = mydb.db_engine_spec.extra_table_metadata(mydb, parts[1], parts[0])
                    if data.get("partitions"):
                        latest = data.get("partitions").get("latest").get("ds")
                        print('datasource {} latest partition:{}'.format(datasource_name, latest))
                except Exception:
                    print('\n\n datasource_name:{} has error'.format(datasource_name))

            # for is_available datasources:
            if False:
                # send chart urls if its data is landed
                is_available = True
                if is_available:
                    form_data = get_form_data(slc.id, dashboard)
                    # {'slice_id': 45181, 'extra_filters': [{'col': '__time_range', 'op': 'in', 'val': '2019-07-01T00:00:00 : now'}]}
                    url = f"http://0.0.0.0:8088/superset/explore/?form_data={quote_plus(json.dumps(form_data))}&force=true"
                    print('i am url with dashboard filter:{}'.format(url))
                    urls.append(url)

        return []


strategies = [DummyStrategy, TopNDashboardsStrategy, DashboardTagsStrategy, DashboardTableStrategy]


@celery_app.task(name="cache-warmup")
def cache_warmup(strategy_name, *args, **kwargs):
    """
    Warm up cache.

    This task periodically hits charts to warm up the cache.

    """
    logger.info("Loading strategy")
    class_ = None
    for class_ in strategies:
        if class_.name == strategy_name:
            break
    else:
        message = f"No strategy {strategy_name} found!"
        logger.error(message)
        return message

    logger.info(f"Loading {class_.__name__}")
    try:
        strategy = class_(*args, **kwargs)
        logger.info("Success!")
    except TypeError:
        message = "Error loading strategy!"
        logger.exception(message)
        return message

    results = {"success": [], "errors": []}
    for url in strategy.get_urls():
        try:
            logger.info(f"Fetching {url}")
            req = request.Request(url)
            req.add_header("X-Internalauth-Username", "grace_guo")
            req.add_header("Cookie", "session=.eJylkU9rHDEMxb9K8Hmz4_8zHgih9JR76aUEI1tyxmR2Zhl7k5aQ717v5hrKht4k9H7vCemN_YAw0_d1Ph2Wh2XOC_3M9Op9oVLyuvi0bgcPsbaajayrZ3W8qPNF_dLUHSB29z7N1XN_UdxJ1WvBdle5E-bqj8_N3gljrLsSq7nOxMY3dnNo6DfEmw-AvV_Hv2Z8otrQtn2L9GmjMrExwVyotRnbiKNOCZxQErUMIqGLQvFBKS24dVFbLbkgbklapVTEEHiyUcvBgUEKw6BNiMIKHqQA20tpyZExEGUS0AOkQNRzHaMJAUAO2lljjdDYc-eChrZXLFvydX2m8_0HJUMQlMgmoECaS6V75Mo62_y5M6FXUjnbuHmNcL4Pa-COHeGJ_JRLXbc_bPzFplqPZey6cjrSVqjeFlgwrL_3uD-cSoV9nDqEMoUVNuzmBnbN5WvU-a-dkNaYL6P_Gag-Qf8V9Lhjp0Lbx8-1dgN7_wsURgsP.Xllp9Q.eSAvVyath0Eb8h1QXxWr5fr0y60; Domain=.d.musta.ch; Secure; HttpOnly; Path=/")
            request.urlopen(req, timeout=600)
            results["success"].append(url)
        except URLError:
            logger.exception("Error warming up cache!")
            results["errors"].append(url)

    return results
