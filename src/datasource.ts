import defaults from 'lodash/defaults';
import _ from 'lodash';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
} from '@grafana/data';
import { MyQuery, MyDataSourceOptions, defaultQuery, MyVariableQuery } from './types';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime'; //proxies requests through Grafana server

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;
  user: string;
  password: string;
  proxyUrl: string;
  tokenPrefix = '_dremio';
  token = undefined;

  typesMap = {
    BOOLEAN: FieldType.boolean,
    INTEGER: FieldType.number,
    BIGINT: FieldType.number,
    FLOAT: FieldType.number,
    DOUBLE: FieldType.number,
    DECIMAL: FieldType.number,
    VARCHAR: FieldType.string,
    TIME: FieldType.time,
    DATE: FieldType.time,
    TIMESTAMP: FieldType.time,
  };

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.url = instanceSettings.jsonData.url || '';
    this.user = instanceSettings.jsonData.user || '';
    this.password = instanceSettings.jsonData.password || '';
    this.proxyUrl = instanceSettings.url ? instanceSettings.url : this.url; //default to non-proxied request
  }

  async getUserToken() {
    return getBackendSrv().datasourceRequest({
      method: 'POST',
      url: `${this.proxyUrl}/apiv2/login`,
      headers: { 'Content-Type': 'application/json' },
      data: { userName: this.user, password: this.password },
    });
  }

  async sendQuery(query: string) {
    return getBackendSrv().datasourceRequest({
      method: 'POST',
      url: `${this.proxyUrl}/api/v3/sql`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.tokenPrefix + this.token,
      },
      data: { sql: query },
    });
  }

  async getJobInfo(jobId: string) {
    return getBackendSrv().datasourceRequest({
      method: 'GET',
      url: `${this.proxyUrl}/api/v3/job/${jobId}`,
      headers: {
        Authorization: this.tokenPrefix + this.token,
      },
    });
  }

  async getJobResults(jobId: string, limit?: number, offset?: number) {
    return getBackendSrv().datasourceRequest({
      method: 'GET',
      url: `${this.proxyUrl}/api/v3/job/${jobId}/results`,
      headers: {
        Authorization: this.tokenPrefix + this.token,
      },
      params: {
        limit: limit,
        offset: offset,
      },
    });
  }

  /**
   * Convert Dremio job results in a data frame.
   * @param data      Dremio data, e.g.: {rowCount: 10, schema: [{name: 'code', type: {name: 'VARCHAR'}}], rows: [{code: '1234'}, ...]}
   * @param timeCol   Name of the time field
   * @param refId     Query ID
   * @returns MutableDataFrame<any>
   */
  getDataframe(data: any, timeCol: string, refId: string): MutableDataFrame<any> {
    let frameFields: any = {};

    _.forEach(data.schema, (field: any) => {
      let type = undefined;
      if (field.name === timeCol) {
        type = FieldType.time;
      } else {
        type = _.find(this.typesMap, (val, key) => {
          return _.lowerCase(key) === _.lowerCase(field.type.name);
        });
      }

      frameFields[field.name] = {
        fieldType: type ? type : FieldType.other,
        values: [],
      };
    });

    _.forEach(data.rows, (row: any) => {
      _.forOwn(row, (val, key) => {
        frameFields[key].values.push(val);
      });
    });

    const frame = new MutableDataFrame({
      refId: refId,
      fields: [],
    });

    _.forOwn(frameFields, (val, key) => {
      frame.addField({ name: key, type: val.fieldType, values: val.values });
    });

    return frame;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    try {
      //1. ensure there is a token
      if (this.token === undefined) {
        const tokenResponse = await this.getUserToken();
        this.token = tokenResponse.data.token;
      }

      //2. for each query
      const promises = options.targets.map(async target => {
        if (target.queryText === undefined || _.isEmpty(target.queryText)) {
          //short-circuit if there is no query
          return new MutableDataFrame();
        }

        //apply defaults
        const query = defaults(target, defaultQuery);
        //interpolate template vars, default to wrapping each value in single quotes as expected by Dremio if no format is specified
        let q = getTemplateSrv().replace(query.queryText, options.scopedVars, 'singlequote');

        const data = await this.doQuery(q, query.refId, query.queryTimeout, query.maxRecords);
        return this.getDataframe(data, query.timeCol, query.refId);
      });

      return Promise.all(promises).then(data => ({ data }));
    } catch (error) {
      console.log('Something went wrong: ' + error);
      return Promise.reject('Something went wrong: ' + error);
    }
  }

  /**
   * Send query to Dremio, use job ID to keep checking if job has finished until either completion, failure or timeout,
   * then fetch job results.
   * @param q             Query string
   * @param refId         Query ID
   * @param queryTimeout  Timeout in ms
   * @param maxRecords    Max number of records to fetch
   * @returns Dremio data
   */
  async doQuery(q: string, refId: string, queryTimeout: number, maxRecords: number) {
    //2.1. send query and receive job ID
    const queryResponse = await this.sendQuery(q);
    console.log('query', refId, 'job ID', queryResponse.data.id);

    //2.2 check job status
    let running = true;
    let completed = false;
    let errorMessage = '';
    let rowCount = 0;

    const timer = setTimeout(() => {
      running = false;
      errorMessage = 'Query ' + refId + ' timed out';
    }, queryTimeout * 1000);

    while (running) {
      const jobInfo = await this.getJobInfo(queryResponse.data.id);
      console.log('query', refId, 'job state', jobInfo.data.jobState);

      //job states: NOT_SUBMITTED, STARTING, RUNNING, COMPLETED, CANCELED, FAILED, CANCELLATION_REQUESTED, ENQUEUED
      if (jobInfo.data.jobState === 'COMPLETED') {
        running = false;
        completed = true;
        clearTimeout(timer);
        rowCount = jobInfo.data.rowCount;
      } else if (jobInfo.data.jobState === 'FAILED') {
        running = false;
        errorMessage = jobInfo.data.errorMessage;
        clearTimeout(timer);
      } //else keep trying until timeout
    }

    if (completed) {
      //2.3 use job ID to retrieve result
      const data = await this.getCompleteJobResults(queryResponse.data.id, rowCount, maxRecords);

      //2.4 return data
      return data;
    } else {
      return Promise.reject('Query ' + refId + ' failed. ' + errorMessage);
    }
  }

  async getCompleteJobResults(jobId: string, rowCount: number, maxRecords: number) {
    const recordsToFetch = rowCount > maxRecords ? maxRecords : rowCount;
    const API_LIMIT = 500; //max results supported by the API

    if (recordsToFetch <= API_LIMIT) {
      //short-circuit
      const jobResults = await this.getJobResults(jobId, recordsToFetch);
      return jobResults.data;
    }

    //get first page
    const jobResults = await this.getJobResults(jobId, API_LIMIT);
    let data = jobResults.data;

    //get all pages except last one and add their rows to the first one
    const pages = Math.floor(recordsToFetch / API_LIMIT);
    const remainder = recordsToFetch % API_LIMIT;

    let pageIndex;
    for (pageIndex = 1; pageIndex < pages; pageIndex++) {
      const newPage = await this.getJobResults(jobId, API_LIMIT, API_LIMIT * pageIndex);
      data.rows.push(...newPage.data.rows);
    }

    //get last page if there are remaining records to fetch
    if (remainder > 0) {
      const lastPage = await this.getJobResults(jobId, remainder, API_LIMIT * pageIndex);
      data.rows.push(...lastPage.data.rows);
    }

    return data;
  }

  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to API';
    try {
      const response = await this.getUserToken();
      if (response.status === 200) {
        //server is reachable and credentials are valid
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      const errorMessage = _.isString(err) ? err : defaultErrorMessage;
      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }

  async metricFindQuery(query: MyVariableQuery, options?: any): Promise<MetricFindValue[]> {
    if (query.rawQuery === undefined || _.isEmpty(query.rawQuery)) {
      //short-circuit if there is no query
      return [];
    }

    try {
      //ensure there is a token
      if (this.token === undefined) {
        const tokenResponse = await this.getUserToken();
        this.token = tokenResponse.data.token;
      }

      //interpolate template vars
      let q = getTemplateSrv().replace(query.rawQuery, undefined, 'singlequote');

      //execute query
      const data = await this.doQuery(q, 'var', 60, 10000);

      //convert query results to a MetricFindValue[]
      const values = data.rows.filter((row: any) => row[query.column]).map((row: any) => ({ text: row[query.column] }));
      return values;
    } catch (error) {
      console.log('Error fetching values: ' + error);
      return Promise.reject('Error fetching values: ' + error);
    }
  }
}
