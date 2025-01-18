import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../config';
import { performanceMonitoring } from './performanceMonitoring';
import { completeAnalytics } from './completeAnalytics';

interface SearchQuery {
  query: string;
  filters?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
    value: any;
  }>;
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  pagination: {
    offset: number;
    limit: number;
  };
  options?: {
    fuzzyMatch?: boolean;
    semanticSearch?: boolean;
    includeMetadata?: boolean;
    highlightMatches?: boolean;
  };
}

interface SearchResult {
  id: string;
  type: 'message' | 'thread' | 'user' | 'media';
  content: string;
  score: number;
  highlights?: Array<{
    field: string;
    snippet: string;
    positions: Array<[number, number]>;
  }>;
  metadata?: Record<string, any>;
}

interface SearchIndex {
  id: string;
  name: string;
  type: 'message' | 'thread' | 'user' | 'media';
  fields: Array<{
    name: string;
    type: 'text' | 'keyword' | 'number' | 'date';
    searchable: boolean;
    weight: number;
  }>;
  settings: {
    language: string;
    stopwords: string[];
    synonyms: Array<{
      terms: string[];
    }>;
  };
}

export class AdvancedSearchService {
  private static instance: AdvancedSearchService;
  private bigquery: BigQuery;
  private storage: Storage;
  private pubsub: PubSub;
  private indices: Map<string, SearchIndex>;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_RESULTS = 1000;
  private readonly REINDEX_INTERVAL = 86400000; // 24 hours

  private constructor() {
    this.bigquery = new BigQuery({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.pubsub = new PubSub({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.indices = new Map();

    this.initializeService();
  }

  public static getInstance(): AdvancedSearchService {
    if (!AdvancedSearchService.instance) {
      AdvancedSearchService.instance = new AdvancedSearchService();
    }
    return AdvancedSearchService.instance;
  }

  private async initializeService(): Promise<void> {
    await this.loadIndices();
    this.startPeriodicReindexing();
    this.setupEventSubscription();
  }

  // Search Operations
  async search(
    indexId: string,
    query: SearchQuery
  ): Promise<{
    results: SearchResult[];
    total: number;
    metadata: {
      executionTime: number;
      indexUsed: string;
      strategy: string;
    };
  }> {
    const startTime = Date.now();
    const index = this.indices.get(indexId);
    if (!index) {
      throw new Error('Index not found');
    }

    try {
      let results: SearchResult[];
      let strategy: string;

      if (query.options?.semanticSearch) {
        [results, strategy] = await this.semanticSearch(index, query);
      } else {
        [results, strategy] = await this.keywordSearch(index, query);
      }

      if (query.options?.highlightMatches) {
        results = this.addHighlights(results, query.query);
      }

      const total = await this.countResults(index, query);
      const executionTime = Date.now() - startTime;

      // Track search analytics
      await completeAnalytics.trackEvent({
        type: 'search_executed',
        data: {
          indexId,
          query: query.query,
          resultCount: results.length,
          executionTime,
          strategy,
        },
        metadata: {
          service: 'advanced-search',
          environment: config.app.env,
          version: '1.0.0',
        },
      });

      return {
        results: results.slice(
          query.pagination.offset,
          query.pagination.offset + query.pagination.limit
        ),
        total,
        metadata: {
          executionTime,
          indexUsed: indexId,
          strategy,
        },
      };
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'search',
        indexId,
        query: query.query,
      });
      throw error;
    }
  }

  // Index Management
  async createIndex(params: Omit<SearchIndex, 'id'>): Promise<SearchIndex> {
    const index: SearchIndex = {
      ...params,
      id: crypto.randomUUID(),
    };

    await this.validateIndex(index);
    await this.persistIndex(index);
    this.indices.set(index.id, index);

    return index;
  }

  async updateIndex(
    indexId: string,
    updates: Partial<SearchIndex>
  ): Promise<SearchIndex> {
    const index = this.indices.get(indexId);
    if (!index) {
      throw new Error('Index not found');
    }

    const updatedIndex = {
      ...index,
      ...updates,
    };

    await this.validateIndex(updatedIndex);
    await this.persistIndex(updatedIndex);
    this.indices.set(indexId, updatedIndex);

    return updatedIndex;
  }

  async deleteIndex(indexId: string): Promise<void> {
    const index = this.indices.get(indexId);
    if (!index) {
      throw new Error('Index not found');
    }

    await this.deleteIndexData(index);
    this.indices.delete(indexId);
  }

  // Document Management
  async indexDocument(params: {
    indexId: string;
    document: Record<string, any>;
  }): Promise<void> {
    const index = this.indices.get(params.indexId);
    if (!index) {
      throw new Error('Index not found');
    }

    await this.validateDocument(params.document, index);
    await this.insertDocument(params.document, index);

    // Publish indexing event
    await this.publishEvent('document_indexed', {
      indexId: params.indexId,
      documentId: params.document.id,
    });
  }

  async bulkIndex(params: {
    indexId: string;
    documents: Record<string, any>[];
  }): Promise<void> {
    const index = this.indices.get(params.indexId);
    if (!index) {
      throw new Error('Index not found');
    }

    const validDocuments = await Promise.all(
      params.documents.map(async doc => {
        try {
          await this.validateDocument(doc, index);
          return doc;
        } catch (error) {
          performanceMonitoring.recordError(error as Error, {
            operation: 'bulkIndex',
            indexId: params.indexId,
            documentId: doc.id,
          });
          return null;
        }
      })
    );

    const documents = validDocuments.filter(
      (doc): doc is Record<string, any> => doc !== null
    );
    await this.insertDocuments(documents, index);

    // Publish bulk indexing event
    await this.publishEvent('documents_bulk_indexed', {
      indexId: params.indexId,
      count: documents.length,
    });
  }

  // Private Methods
  private async semanticSearch(
    index: SearchIndex,
    query: SearchQuery
  ): Promise<[SearchResult[], string]> {
    // Implementation would use embeddings and vector similarity search
    // This is a placeholder that falls back to keyword search
    const [results] = await this.keywordSearch(index, query);
    return [results, 'semantic_search'];
  }

  private async keywordSearch(
    index: SearchIndex,
    query: SearchQuery
  ): Promise<[SearchResult[], string]> {
    const sqlQuery = this.buildSearchQuery(index, query);
    const [rows] = await this.bigquery.query({ query: sqlQuery });

    const results: SearchResult[] = rows.map((row: any) => ({
      id: row.id,
      type: index.type,
      content: row.content,
      score: row.score,
      metadata: query.options?.includeMetadata ? row.metadata : undefined,
    }));

    return [results, 'keyword_search'];
  }

  private buildSearchQuery(index: SearchIndex, query: SearchQuery): string {
    const searchableFields = index.fields
      .filter(f => f.searchable)
      .map(f => f.name);

    let sql = `
      SELECT
        id,
        content,
        ${query.options?.includeMetadata ? 'metadata,' : ''}
        ts_rank(
          to_tsvector('${index.settings.language}', content),
          to_tsquery('${index.settings.language}', @query)
        ) as score
      FROM \`${config.gcp.projectId}.search.${index.name}\`
      WHERE `;

    // Add search conditions
    const conditions: string[] = [
      `to_tsvector('${index.settings.language}', content) @@ to_tsquery('${index.settings.language}', @query)`,
    ];

    // Add filters
    if (query.filters) {
      query.filters.forEach((filter, i) => {
        conditions.push(this.buildFilterCondition(filter, i));
      });
    }

    sql += conditions.join(' AND ');

    // Add sorting
    if (query.sort) {
      const sortClauses = query.sort.map(
        sort => `${sort.field} ${sort.direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${sortClauses.join(', ')}`;
    } else {
      sql += ' ORDER BY score DESC';
    }

    // Add pagination
    sql += ` LIMIT ${this.MAX_RESULTS}`;

    return sql;
  }

  private buildFilterCondition(
    filter: SearchQuery['filters'][0],
    index: number
  ): string {
    const paramName = `filter_${index}`;
    switch (filter.operator) {
      case 'equals':
        return `${filter.field} = @${paramName}`;
      case 'contains':
        return `${filter.field} LIKE @${paramName}`;
      case 'gt':
        return `${filter.field} > @${paramName}`;
      case 'lt':
        return `${filter.field} < @${paramName}`;
      case 'between':
        return `${filter.field} BETWEEN @${paramName}_start AND @${paramName}_end`;
      default:
        return '';
    }
  }

  private addHighlights(
    results: SearchResult[],
    query: string
  ): SearchResult[] {
    return results.map(result => ({
      ...result,
      highlights: this.generateHighlights(result.content, query),
    }));
  }

  private generateHighlights(
    content: string,
    query: string
  ): SearchResult['highlights'] {
    const words = query.toLowerCase().split(/\s+/);
    const positions: Array<[number, number]> = [];

    words.forEach(word => {
      let pos = content.toLowerCase().indexOf(word);
      while (pos !== -1) {
        positions.push([pos, pos + word.length]);
        pos = content.toLowerCase().indexOf(word, pos + 1);
      }
    });

    // Merge overlapping positions
    const mergedPositions = this.mergePositions(positions);

    return [
      {
        field: 'content',
        snippet: this.generateSnippet(content, mergedPositions[0] || [0, 0]),
        positions: mergedPositions,
      },
    ];
  }

  private mergePositions(
    positions: Array<[number, number]>
  ): Array<[number, number]> {
    if (positions.length === 0) return [];

    const sorted = positions.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = merged[merged.length - 1];

      if (current[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], current[1]);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  private generateSnippet(
    content: string,
    position: [number, number],
    contextLength: number = 50
  ): string {
    const start = Math.max(0, position[0] - contextLength);
    const end = Math.min(content.length, position[1] + contextLength);
    let snippet = content.slice(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  private async countResults(
    index: SearchIndex,
    query: SearchQuery
  ): Promise<number> {
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`${config.gcp.projectId}.search.${index.name}\`
      WHERE to_tsvector('${index.settings.language}', content) @@ to_tsquery('${index.settings.language}', @query)
    `;

    const [rows] = await this.bigquery.query({ query: countQuery });
    return rows[0].count;
  }

  private async validateIndex(index: SearchIndex): Promise<void> {
    if (!index.fields.some(f => f.searchable)) {
      throw new Error('Index must have at least one searchable field');
    }

    if (!index.settings.language) {
      throw new Error('Index must specify a language');
    }
  }

  private async validateDocument(
    document: Record<string, any>,
    index: SearchIndex
  ): Promise<void> {
    for (const field of index.fields) {
      if (!document.hasOwnProperty(field.name)) {
        throw new Error(`Document missing required field: ${field.name}`);
      }
    }
  }

  private async persistIndex(index: SearchIndex): Promise<void> {
    const bucket = this.storage.bucket(config.gcp.storageBucket);
    const file = bucket.file(`search/indices/${index.id}.json`);
    await file.save(JSON.stringify(index, null, 2));
  }

  private async loadIndices(): Promise<void> {
    const bucket = this.storage.bucket(config.gcp.storageBucket);
    const [files] = await bucket.getFiles({ prefix: 'search/indices/' });

    await Promise.all(
      files.map(async file => {
        const content = await file.download();
        const index: SearchIndex = JSON.parse(content[0].toString());
        this.indices.set(index.id, index);
      })
    );
  }

  private async deleteIndexData(index: SearchIndex): Promise<void> {
    // Delete index configuration
    const bucket = this.storage.bucket(config.gcp.storageBucket);
    const file = bucket.file(`search/indices/${index.id}.json`);
    await file.delete();

    // Delete index data table
    const dataset = this.bigquery.dataset('search');
    const table = dataset.table(index.name);
    await table.delete();
  }

  private async insertDocument(
    document: Record<string, any>,
    index: SearchIndex
  ): Promise<void> {
    const dataset = this.bigquery.dataset('search');
    const table = dataset.table(index.name);
    await table.insert([document]);
  }

  private async insertDocuments(
    documents: Record<string, any>[],
    index: SearchIndex
  ): Promise<void> {
    const dataset = this.bigquery.dataset('search');
    const table = dataset.table(index.name);
    await table.insert(documents);
  }

  private async publishEvent(
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    const topic = this.pubsub.topic('search-events');
    const messageData = {
      eventType,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await topic.publish(Buffer.from(JSON.stringify(messageData)));
  }

  private startPeriodicReindexing(): void {
    setInterval(async () => {
      for (const index of this.indices.values()) {
        try {
          await this.reindexData(index);
        } catch (error) {
          performanceMonitoring.recordError(error as Error, {
            operation: 'periodicReindexing',
            indexId: index.id,
          });
        }
      }
    }, this.REINDEX_INTERVAL);
  }

  private async reindexData(index: SearchIndex): Promise<void> {
    // Implementation would depend on data source and indexing strategy
    // This is a placeholder
    await this.publishEvent('reindex_started', { indexId: index.id });
  }

  private setupEventSubscription(): void {
    const topic = this.pubsub.topic('search-events');
    const subscription = topic.subscription('search-processor');

    subscription.on('message', async message => {
      try {
        const event = JSON.parse(message.data.toString());
        // Handle different event types
        message.ack();
      } catch (error) {
        performanceMonitoring.recordError(error as Error, {
          operation: 'processSearchEvent',
          messageId: message.id,
        });
        message.nack();
      }
    });
  }
}

export const advancedSearch = AdvancedSearchService.getInstance();
