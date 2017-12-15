import React from 'react';
import Inspector from 'react-json-inspector';
import { OverlayTrigger, Popover } from 'react-bootstrap';

import './JSONPopover.css';
import { isJSONString } from '../../utils/common';

export default class JSONPopover extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sql_clause: 'Click any node to select a path',
    };

    this.renderClause = this.renderClause.bind(this);
  }
  renderClause({ path, key }) {
    console.log('current data', this.props.data);
    console.log('data type', this.props.dataType);

    const segments = path.split('.');
    const json_path = [];
    segments.forEach(seg => {
      const numSeg = parseInt(seg);
      if (Number.isNaN(numSeg)) {
        json_path.push(seg);
      } else {
        json_path.push('[' + numSeg + ']');
      }
    });
    let clause;
    switch(this.props.dataType) {
      case 'OBJECT':
        const key = json_path.slice();
        const body = json_path.slice(1);
        if (body.length) {
          clause = `json_extract(${this.props.columnName}['${key}'], '$.${body.join('.')}')`;
        } else {
          clause = `${this.props.columnName}['${key}']`;
        }
        break;
      default:
        clause = `json_extract_scalar(${this.props.columnName}, '$.${json_path.join('.')}')`;
        break;
    }

    this.setState({
      sql_clause: clause,
    });
  }

  renderPopover() {
    let content = '';
    try {
      const data = JSON.parse(this.props.data);
      content = (
        <Inspector
          data={data}
          onClick={this.renderClause} />
      );
    } catch(e) {
      // parse error
    }

    return (
      <Popover id="json-popover">
        <div className="json-container">{content || 'JSON parse error'}</div>
        <hr />
        <div className="sql-clause-container">{this.state.sql_clause}</div>
      </Popover>
    );

  }

  render() {
    return (
      <OverlayTrigger
        container={document.body}
        trigger="click"
        rootClose
        ref="trigger"
        placement="right"
        overlay={this.renderPopover()}
      >
        <i className="fa fa-plus-square-o">&nbsp;</i>
      </OverlayTrigger>
    );
  }
}