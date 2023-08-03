import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms, Slider, TextArea } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onQueryTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });
  };

  onQueryTimeoutChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryTimeout: parseInt(event.target.value, 10) });
  };

  onTimeColChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, timeCol: event.target.value });
  };

  onMaxRecordsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, maxRecords: parseInt(event.target.value, 10) });
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { queryText, queryTimeout, timeCol, maxRecords } = query;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <label className="gf-form-label width-10">Query Text</label>
          <TextArea
            className="gf-form-input"
            value={queryText || ''}
            onChange={this.onQueryTextChange}
            required
            css={undefined}
          />
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              value={queryTimeout}
              onChange={this.onQueryTimeoutChange}
              label="Timeout (seconds)"
              labelWidth={10}
              type="number"
              step="1"
              tooltip="How many seconds to wait for query result (querying large datasets may take some time)"
            />
          </div>
          <div className="gf-form">
            <FormField
              value={timeCol}
              onChange={this.onTimeColChange}
              label="Time column"
              labelWidth={10}
              tooltip="Required for time series visualization (defaults to 'time_col')"
            />
          </div>
          <div className="gf-form">
            <FormField
              value={maxRecords}
              onChange={this.onMaxRecordsChange}
              label="Max records"
              labelWidth={10}
              type="number"
              step="1"
              tooltip="Maximum number of records to fetch (defaults to 10000, which is the maximum allowed)"
            />
          </div>
        </div>
      </div>
    );
  }
}
