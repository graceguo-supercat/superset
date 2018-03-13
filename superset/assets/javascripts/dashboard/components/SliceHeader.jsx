import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import { t } from '../../locales';
import EditableTitle from '../../components/EditableTitle';
import TooltipWrapper from '../../components/TooltipWrapper';

const propTypes = {
  slice: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  isCached: PropTypes.bool,
  cachedDttm: PropTypes.string,
  removeSlice: PropTypes.func,
  updateSliceName: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  forceRefresh: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  editMode: PropTypes.bool,
  annotationQuery: PropTypes.object,
  annotationError: PropTypes.object,
};

const defaultProps = {
  forceRefresh: () => ({}),
  removeSlice: () => ({}),
  updateSliceName: () => ({}),
  toggleExpandSlice: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  editMode: false,
};

class SliceHeader extends React.PureComponent {
  constructor(props) {
    super(props);

    this.onSaveTitle = this.onSaveTitle.bind(this);
    this.onToggleExpandSlice = this.onToggleExpandSlice.bind(this);
    this.exportCSV = this.props.exportCSV.bind(this, this.props.slice);
    this.exploreChart = this.props.exploreChart.bind(this, this.props.slice);
    this.forceRefresh = this.props.forceRefresh.bind(this, this.props.slice.slice_id);
    this.removeSlice = this.props.removeSlice.bind(this, this.props.slice);
  }

  onSaveTitle(newTitle) {
    if (this.props.updateSliceName) {
      this.props.updateSliceName(this.props.slice.slice_id, newTitle);
    }
  }

  onToggleExpandSlice() {
    this.props.toggleExpandSlice(this.props.slice, !this.props.isExpanded);
  }

  render() {
    const slice = this.props.slice;
    const isCached = this.props.isCached;
    const cachedWhen = moment.utc(this.props.cachedDttm).fromNow();
    const refreshTooltip = isCached ?
      t('Served from data cached %s . Click to force refresh.', cachedWhen) :
      t('Force refresh data');
    const annoationsLoading = t('Annotation layers are still loading.');
    const annoationsError = t('One ore more annotation layers failed loading.');

    return (
      <div className="row chart-header">
        <div className="col-md-12">
          <div className="header">
            <EditableTitle
              title={slice.slice_name}
              canEdit={!!this.props.updateSliceName && this.props.editMode}
              onSaveTitle={this.onSaveTitle}
              noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
            />
            {!!Object.values(this.props.annotationQuery || {}).length &&
              <TooltipWrapper
                label="annotations-loading"
                placement="top"
                tooltip={annoationsLoading}
              >
                <i className="fa fa-refresh warning" />
              </TooltipWrapper>
            }
            {!!Object.values(this.props.annotationError || {}).length &&
              <TooltipWrapper
                label="annoation-errors"
                placement="top"
                tooltip={annoationsError}
              >
                <i className="fa fa-exclamation-circle danger" />
              </TooltipWrapper>
            }
          </div>
        </div>
      </div>
    );
  }
}

SliceHeader.propTypes = propTypes;
SliceHeader.defaultProps = defaultProps;

export default SliceHeader;
