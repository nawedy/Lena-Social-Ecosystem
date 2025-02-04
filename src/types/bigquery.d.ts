import {
  BigQuery as GoogleBigQuery,
  BigQueryOptions as GoogleBigQueryOptions,
  Dataset as GoogleDataset,
  DatasetMetadata as GoogleDatasetMetadata,
  Job as GoogleJob,
  JobMetadata as GoogleJobMetadata,
  Query as GoogleQuery,
  QueryOptions as GoogleQueryOptions,
  Table as GoogleTable,
  TableMetadata as GoogleTableMetadata,
} from '@google-cloud/bigquery';
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
    params?: GoogleQuery['parameterValues'];
    maxResults?: number;
  }

  export interface QueryResults {
    metadata: GoogleJobMetadata;
    rows: GoogleQuery['rows'];
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
    }
    status?: {
      state: string;
      errorResult?: {
        reason: string;
        location: string;
        message: string;
      };
    };
  }

  export interface Job extends GoogleJob{
    id: string;
    metadata: GoogleJobMetadata;
    getMetadata(): Promise<[GoogleJobMetadata]>;
  }

  export interface TableMetadata extends GoogleTableMetadata {
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

  export interface Table extends GoogleTable{
    id: string
    metadata: GoogleTableMetadata;
    exists(): Promise<[boolean]>;
    get(): Promise<[GoogleTableMetadata]>;
    insert(rows: GoogleQuery['rows'][]): Promise<void>;
  }

  export interface Dataset extends GoogleDataset{
    id: string;
    table(tableId: string): GoogleTable;
  }

  export default class BigQuery extends GoogleBigQuery {
    constructor(options?: GoogleBigQueryOptions);

    createQueryJob(options: GoogleQueryOptions): Promise<[GoogleJob]>;
    query(options: GoogleQueryOptions): Promise<[GoogleQuery['rows'], GoogleJobMetadata]>;
    dataset(datasetId: string): GoogleDataset;
    table(tableId: string): GoogleTable;
  }
  
  export {
    GoogleBigQueryOptions,
    GoogleDataset,
    GoogleDatasetMetadata,
    GoogleJob,
    GoogleJobMetadata,
    GoogleTable,
    GoogleTableMetadata
  }
}
