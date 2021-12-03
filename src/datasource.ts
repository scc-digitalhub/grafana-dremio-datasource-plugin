import defaults from 'lodash/defaults';
import _ from 'lodash';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';
import { getBackendSrv } from '@grafana/runtime'; //proxies requests through Grafana server

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url: string;
  user: string;
  password: string;
  proxyUrl: string;
  tokenPrefix = '_dremio';
  token = undefined;

  typesMap = {
    BOOLEAN: FieldType.boolean,
    INTEGER: FieldType.number, BIGINT: FieldType.number, FLOAT: FieldType.number, DOUBLE: FieldType.number, DECIMAL: FieldType.number,
    VARCHAR: FieldType.string,
    TIME: FieldType.time, DATE: FieldType.time, TIMESTAMP: FieldType.time,
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
      method: "POST",
      url: `${this.proxyUrl}/apiv2/login`,
      headers: {"Content-Type": "application/json"},
      data: {userName: this.user, password: this.password},
    });
  }

  async sendQuery(query: string) {
    return getBackendSrv().datasourceRequest({
      method: "POST",
      url: `${this.proxyUrl}/api/v3/sql`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.tokenPrefix + this.token,
      },
      data: {sql: query},
    });
  }

  async getJobInfo(jobId: string) {
    return getBackendSrv().datasourceRequest({
      method: "GET",
      url: `${this.proxyUrl}/api/v3/job/${jobId}`,
      headers: {
        "Authorization": this.tokenPrefix + this.token,
      },
    });
  }

  async getJobResults(jobId: string) {
    return getBackendSrv().datasourceRequest({
      method: "GET",
      url: `${this.proxyUrl}/api/v3/job/${jobId}/results`,
      headers: {
        "Authorization": this.tokenPrefix + this.token,
      },
    });
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
        const query = defaults(target, defaultQuery);

        if(query.queryText === undefined || _.isEmpty(query.queryText)) {
          //there is no query to execute, return nothing
          return new MutableDataFrame();
        }

        //2.1. send query and receive job ID
        const queryResponse = await this.sendQuery(query.queryText);
        console.log('job ID', queryResponse.data.id);

        //2.2 check job status
        var running = true;
        var completed = false;
        var errorMessage = '';

        const timer = setTimeout(() => {
          running = false;
          errorMessage = 'Query ' + query.refId + ' timed out';
        }, query.queryTimeout*1000);

        while(running) {
          const jobInfo = await this.getJobInfo(queryResponse.data.id);
          console.log('job state', jobInfo.data.jobState);

          //job states: NOT_SUBMITTED, STARTING, RUNNING, COMPLETED, CANCELED, FAILED, CANCELLATION_REQUESTED, ENQUEUED
          if(jobInfo.data.jobState == 'COMPLETED') {
            running = false;
            completed = true;
            clearTimeout(timer);
          } else if(jobInfo.data.jobState == 'FAILED') {
            running = false;
            errorMessage = jobInfo.data.errorMessage;
            clearTimeout(timer);
          } //else keep trying until timeout
        }

        if(completed) {
          //2.3 use job ID to retrieve result
          const jobResults = await this.getJobResults(queryResponse.data.id);

          //2.4 prepare data frame
          var frameFields: any = {};

          _.forEach(jobResults.data.schema, (field: any) => {
            var type = undefined;
            if(field.name === query.timeCol) {
              type = FieldType.time;
            } else {
              type = _.find(this.typesMap, (val, key) => { return _.lowerCase(key) === _.lowerCase(field.type.name); });
            }

            frameFields[field.name] = {
              fieldType: (type ? type : FieldType.other),
              values: [],
            };
          }); //frameFields = { mytime: {fieldType: number, values: []} }

          _.forEach(jobResults.data.rows, (row: any) => {
            _.forOwn(row, (val, key) => {
              frameFields[key].values.push(val);
            });
          });

          const frame = new MutableDataFrame({
            refId: query.refId,
            fields: [],
          });

          _.forOwn(frameFields, (val, key) => {
            frame.addField({ name: key, type: val.fieldType, values: val.values });
          });

          return frame;
        } else {
          throw new Error('Query ' + query.refId + ' failed. ' + errorMessage);
        }
      });

      return Promise.all(promises).then((data) => ({ data }));
    } catch(err) {
      console.log(err);
      return { data: [] };
    }
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
    } catch(err) {
      const errorMessage = _.isString(err) ? err : defaultErrorMessage;
      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }
}
