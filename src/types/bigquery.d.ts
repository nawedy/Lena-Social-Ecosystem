declare module '@google-cloud/bigquery' {
  export interface BigQueryOptions {
    projectId?: string;
    keyFilename?: string;
    credentials?: {
      client_email: string;
      private_key: string;
    };
  }

  export interface QueryOptions {
    query: string;
    location?: string;
    useLegacySql?: boolean;
    params?: any;
    maxResults?: number;
  }

  export interface Job {
    id: string;
    metadata: any;
    getMetadata(): Promise<any[]>;
  }

  export interface Table {
    id: string;
    metadata: any;
    exists(): Promise<boolean>;
    get(): Promise<any>;
    insert(rows: any[]): Promise<any>;
  }

  export default class BigQuery {
    constructor(options?: BigQueryOptions);

    createQueryJob(options: QueryOptions): Promise<[Job]>;
    query(options: QueryOptions): Promise<[any[], any]>;
    dataset(datasetId: string): any;
    table(tableId: string): Table;
  }
}
