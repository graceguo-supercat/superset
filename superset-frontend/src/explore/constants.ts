/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { t } from '@superset-ui/core';

export const AGGREGATES = {
  AVG: 'AVG',
  COUNT: 'COUNT',
  COUNT_DISTINCT: 'COUNT_DISTINCT',
  MAX: 'MAX',
  MIN: 'MIN',
  SUM: 'SUM',
};
export const AGGREGATES_OPTIONS = Object.values(AGGREGATES);

export const OPERATORS = {
  '==': '==',
  '!=': '!=',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  IN: 'IN',
  'NOT IN': 'NOT IN',
  LIKE: 'LIKE',
  REGEX: 'REGEX',
  'IS NOT NULL': 'IS NOT NULL',
  'IS NULL': 'IS NULL',
  'LATEST PARTITION': 'LATEST PARTITION',
  'IS TRUE': 'IS TRUE',
  'IS FALSE': 'IS FALSE',
};

export const OPERATORS_OPTIONS = Object.values(OPERATORS);

export const TABLE_ONLY_OPERATORS = [OPERATORS.LIKE];
export const DRUID_ONLY_OPERATORS = [OPERATORS.REGEX];
export const HAVING_OPERATORS = [
  OPERATORS['=='],
  OPERATORS['!='],
  OPERATORS['>'],
  OPERATORS['<'],
  OPERATORS['>='],
  OPERATORS['<='],
];
export const MULTI_OPERATORS = new Set([OPERATORS.IN, OPERATORS['NOT IN']]);
// CUSTOM_OPERATORS will show operator in simple mode,
// but will generate customized sqlExpression
export const CUSTOM_OPERATORS = new Set([OPERATORS['LATEST PARTITION']]);
// DISABLE_INPUT_OPERATORS will disable filter value input
// in adhocFilter control
export const DISABLE_INPUT_OPERATORS = [
  OPERATORS['IS NOT NULL'],
  OPERATORS['IS NULL'],
  OPERATORS['LATEST PARTITION'],
  OPERATORS['IS TRUE'],
  OPERATORS['IS FALSE'],
];

export const sqlaAutoGeneratedMetricNameRegex = /^(sum|min|max|avg|count|count_distinct)__.*$/i;
export const sqlaAutoGeneratedMetricRegex = /^(LONG|DOUBLE|FLOAT)?(SUM|AVG|MAX|MIN|COUNT)\([A-Z0-9_."]*\)$/i;
export const druidAutoGeneratedMetricRegex = /^(LONG|DOUBLE|FLOAT)?(SUM|MAX|MIN|COUNT)\([A-Z0-9_."]*\)$/i;

export const TIME_FILTER_LABELS = {
  time_range: t('Time range'),
  granularity_sqla: t('Time column'),
  time_grain_sqla: t('Time grain'),
  druid_time_origin: t('Origin'),
  granularity: t('Time granularity'),
};

export const FILTER_CONFIG_ATTRIBUTES = {
  CLEARABLE: 'clearable',
  DEFAULT_VALUE: 'defaultValue',
  MULTIPLE: 'multiple',
  SEARCH_ALL_OPTIONS: 'searchAllOptions',
  SORT_ASCENDING: 'asc',
  SORT_METRIC: 'metric',
};

export const FILTER_OPTIONS_LIMIT = 1000;

/**
 * Map control names to their key in extra_filters
 */
export const TIME_FILTER_MAP = {
  time_range: '__time_range',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};

// TODO: make this configurable per Superset installation
export const DEFAULT_TIME_RANGE = 'Last week';
