import React from 'react';
import PropTypes from 'prop-types';
import HTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext } from 'react-dnd';
import cx from 'classnames';

import GridCell from './GridCell';
import BuilderComponentPane from '../v2/components/BuilderComponentPane';
import DashboardGrid from '../v2/containers/DashboardGrid';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  datasources: PropTypes.object,
  charts: PropTypes.object.isRequired,
  filters: PropTypes.object,
  timeout: PropTypes.number,
  onChange: PropTypes.func,
  getFormDataExtra: PropTypes.func,
  exploreChart: PropTypes.func,
  exportCSV: PropTypes.func,
  fetchSlice: PropTypes.func,
  saveSlice: PropTypes.func,
  removeSlice: PropTypes.func,
  removeChart: PropTypes.func,
  toggleExpandSlice: PropTypes.func,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
};

const defaultProps = {
  onChange: () => ({}),
  getFormDataExtra: () => ({}),
  exploreChart: () => ({}),
  exportCSV: () => ({}),
  fetchSlice: () => ({}),
  saveSlice: () => ({}),
  removeSlice: () => ({}),
  removeChart: () => ({}),
  toggleExpandSlice: () => ({}),
  addFilter: () => ({}),
  getFilters: () => ({}),
  clearFilter: () => ({}),
  removeFilter: () => ({}),
};

class GridLayout extends React.Component {
  constructor(props) {
    super(props);

    this.forceRefresh = this.forceRefresh.bind(this);
    this.removeSlice = this.removeSlice.bind(this);
    this.updateSliceName = this.props.dashboard.dash_edit_perm ?
      this.updateSliceName.bind(this) : null;
  }

  getWidgetId(slice) {
    return 'widget_' + slice.slice_id;
  }

  getWidgetHeight(slice) {
    const widgetId = this.getWidgetId(slice);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].parentNode.clientHeight;
  }

  getWidgetWidth(slice) {
    const widgetId = this.getWidgetId(slice);
    if (!widgetId || !this.refs[widgetId]) {
      return 400;
    }
    return this.refs[widgetId].parentNode.clientWidth;
  }

  findSliceIndexById(sliceId) {
    return this.props.dashboard.slices
      .map(slice => (slice.slice_id)).indexOf(sliceId);
  }

  forceRefresh(sliceId) {
    return this.props.fetchSlice(this.props.charts['slice_' + sliceId], true);
  }

  removeSlice(slice) {
    if (!slice) {
      return;
    }

    // remove slice dashboard and charts
    this.props.removeSlice(slice);
    this.props.removeChart(this.props.charts['slice_' + slice.slice_id].chartKey);
    this.props.onChange();
  }

  updateSliceName(sliceId, sliceName) {
    const index = this.findSliceIndexById(sliceId);
    if (index === -1) {
      return;
    }

    const currentSlice = this.props.dashboard.slices[index];
    if (currentSlice.slice_name === sliceName) {
      return;
    }

    this.props.saveSlice(currentSlice, sliceName);
  }

  isExpanded(slice) {
    return this.props.dashboard.metadata.expanded_slices &&
      this.props.dashboard.metadata.expanded_slices[slice.slice_id];
  }

  render() {
    const cells = {};
    this.props.dashboard.slices.map((slice) => {
      const chartKey = `slice_${slice.slice_id}`;
      const currentChart = this.props.charts[chartKey];
      const queryResponse = currentChart.queryResponse || {};
      cells[chartKey] =
        (
        <div
          id={'slice_' + slice.slice_id}
          key={slice.slice_id}
          data-slice-id={slice.slice_id}
          className={`widget ${slice.form_data.viz_type}`}
          ref={this.getWidgetId(slice)}
        >
          <GridCell
            slice={slice}
            chartKey={chartKey}
            datasource={this.props.datasources[slice.form_data.datasource]}
            filters={this.props.filters}
            formData={this.props.getFormDataExtra(slice)}
            timeout={this.props.timeout}
            widgetHeight={this.getWidgetHeight(slice)}
            widgetWidth={this.getWidgetWidth(slice)}
            exploreChart={this.props.exploreChart}
            exportCSV={this.props.exportCSV}
            isExpanded={!!this.isExpanded(slice)}
            isLoading={currentChart.chartStatus === 'loading'}
            isCached={queryResponse.is_cached}
            cachedDttm={queryResponse.cached_dttm}
            toggleExpandSlice={this.props.toggleExpandSlice}
            forceRefresh={this.forceRefresh}
            removeSlice={this.removeSlice}
            updateSliceName={this.updateSliceName}
            addFilter={this.props.addFilter}
            getFilters={this.props.getFilters}
            clearFilter={this.props.clearFilter}
            removeFilter={this.props.removeFilter}
            editMode={this.props.editMode}
            annotationQuery={currentChart.annotationQuery}
            annotationError={currentChart.annotationError}
          />
        </div>
        );
    });

    return (
      <div className={cx('dashboard-builder')}>
        <DashboardGrid
          cells={cells}
        />
        <BuilderComponentPane />
      </div>
    );
  }
}

GridLayout.propTypes = propTypes;
GridLayout.defaultProps = defaultProps;

export default DragDropContext(HTML5Backend)(GridLayout);
