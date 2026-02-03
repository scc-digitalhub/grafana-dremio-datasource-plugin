import React, { useState } from 'react';
import { MyVariableQuery } from '../types';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

interface VariableQueryProps {
  query: MyVariableQuery;
  onChange: (query: MyVariableQuery, definition: string) => void;
}

export const VariableQueryEditor = ({ query, onChange }: VariableQueryProps) => {
  const [state, setState] = useState<MyVariableQuery>(query);

  const saveQuery = () => {
    // Second argument is the human-readable label shown in the variable list
    const definition = `${state.rawQuery} (${state.column})`;
    onChange(state, definition);
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;

    const next = {
      ...state,
      [name]: value,
    };

    setState(next);
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Column" labelWidth={20}>
          <Input
            type="text"
            aria-label="Column selector"
            placeholder="Enter column"
            value={state.column}
            onChange={handleChange}
            onBlur={saveQuery}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={20}>
          <Input
            type="text"
            aria-label="Query selector"
            placeholder="Enter query"
            value={state.rawQuery}
            onChange={handleChange}
            onBlur={saveQuery}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};