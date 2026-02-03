import React, { ChangeEvent } from 'react';
import { InlineField, Input, TextArea } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onQueryTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...query, queryText: event.target.value });
    // // executes the query
    // onRunQuery();
  };


   const onQueryTimeoutChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, queryTimeout: parseInt(event.target.value, 10) });
  };

  const onTimeColChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, timeCol: event.target.value });
  };

  const onMaxRecordsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newval = parseInt(event.target.value, 10);
    if (newval <= 10000) {
      onChange({ ...query, maxRecords: newval });
    }
  };
  const { queryText, queryTimeout, timeCol, maxRecords } = query;

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <label className="gf-form-label">Query Text</label>
          <TextArea className="gf-form"
            id="query-editor-query-text"
            onChange={onQueryTextChange}
            value={queryText || ''}
            required
            placeholder="Enter a query"
          />
      </div>  
      <div className="gf-form">
        <InlineField label="Timeout (seconds)">
          <Input
            id="query-editor-query-timeout"
            onChange={onQueryTimeoutChange}
            value={queryTimeout}
            width={16}
            type="number"
            step="1"
          />
        </InlineField>
        <InlineField label="Time Column">
          <Input
            id="query-editor-time-col"
            onChange={onTimeColChange}
            value={timeCol}
            width={16}
          />
        </InlineField>
        <InlineField label="Max Records">
          <Input
            id="query-editor-max-records"
            onChange={onMaxRecordsChange}
            value={maxRecords}
            width={16}
            type="number"
            step="1"
            min={1}
            max={10000}
          />
        </InlineField>
      </div>
    </div>
  );
}
