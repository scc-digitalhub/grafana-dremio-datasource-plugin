import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

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

export interface DataPoint {
  Time: number;
  Value: number;
}

export interface DataSourceResponse {
  datapoints: DataPoint[];
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url: string;
  user: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  password?: string;
}

/**
 * Options of variables based on queries
 */
export interface MyVariableQuery {
  refId: string;
  rawQuery: string;
  column: string;
}
