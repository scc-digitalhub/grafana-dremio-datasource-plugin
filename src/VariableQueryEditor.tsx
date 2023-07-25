import React, { useState } from 'react';
import { MyVariableQuery } from './types';

interface VariableQueryProps {
  query: MyVariableQuery;
  onChange: (query: MyVariableQuery, definition: string) => void;
}

export const VariableQueryEditor = ({ onChange, query }: VariableQueryProps) => {
  const [state, setState] = useState(query);

  const saveQuery = () => {
    onChange(state, `${state.rawQuery}`);
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    setState({
      ...state,
      [event.currentTarget.name]: event.currentTarget.value,
    });
  };

  return (
    <>
      <div className="gf-form">
        <span className="gf-form-label width-10">Query</span>
        <input
          name="rawQuery"
          className="gf-form-input"
          onBlur={saveQuery}
          onChange={handleChange}
          value={state.rawQuery}
          required
        />
      </div>
      <div className="gf-form">
        <span className="gf-form-label width-10">Column</span>
        <input
          name="column"
          className="gf-form-input"
          onBlur={saveQuery}
          onChange={handleChange}
          value={state.column}
          required
        />
      </div>
    </>
  );
};
