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
    params?: Record<string, unknown>;
    maxResults?: number;
  }

  export interface QueryResultsOptions {
    maxResults?: number;
  }

  export interface JobMetadata {
    id: string;
    user_email: string;
    configuration: {
      query?: {
        query: string;
        destinationTable?: {
          projectId: string;
          datasetId: string;
          tableId: string;
        };
      };
    };
    statistics?: {
      creationTime: string;
      startTime: string;
      endTime?: string;
      totalBytesProcessed?: string;
      totalSlotMs?: string;
    };
    status?: {
      state: string;
      errorResult?: {
        reason: string;
        location: string;
        message: string;
      };
    };
  }

  export interface Job {
    id: string;
    metadata: JobMetadata;
    getMetadata(): Promise<[JobMetadata]>;
  }

  export interface TableMetadata {
    id: string;
    kind: string;
    tableReference: {
      projectId: string;
      datasetId: string;
      tableId: string;
    };
    schema?: {
      fields: {
        name: string;
        type: string;
        mode?: string;
        description?: string;
      }[];
    };
    numRows?: string;
    creationTime?: string;
    lastModifiedTime?: string;
  }

  export interface Table {
    id: string;
    metadata: TableMetadata;
    exists(): Promise<[boolean]>;
    get(): Promise<[Table]>;
    insert(rows: Record<string, unknown>[]): Promise<void>;
  }

  export interface Dataset {
    id: string;
    table(tableId: string): Table;
  }

  export default class BigQuery {
    constructor(options?: BigQueryOptions);

    createQueryJob(options: QueryOptions): Promise<[Job]>;
    query(options: QueryOptions): Promise<[Record<string, unknown>[], JobMetadata]>;
    dataset(datasetId: string): Dataset;
    table(tableId: string): Table;
  }
}
