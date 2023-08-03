import { DataQuery, DataSourceJsonData } from '@grafana/data';

/**
 * Options of the query editor
 */
export interface MyQuery extends DataQuery {
  queryText: string;
  queryTimeout: number;
  timeCol: string;
  maxRecords: number;
}

/**
 * Query editor defaults
 */
export const defaultQuery: Partial<MyQuery> = {
  queryTimeout: 60,
  timeCol: 'time_col',
  maxRecords: 10000,
};

/**
 * Options of variables based on queries
 */
export interface MyVariableQuery {
  rawQuery: string;
  column: string;
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url: string;
  user: string;
  password: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
