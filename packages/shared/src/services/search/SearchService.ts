import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { tracingService } from '../monitoring/TracingService';

interface SearchOptions {
  query: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
  includeFields?: string[];
  excludeFields?: string[];
  searchType?: 'exact' | 'fuzzy' | 'semantic';
  fuzzyThreshold?: number;
  aggregations?: {
    field: string;
    type: 'terms' | 'range' | 'date_histogram';
    options?: Record<string, any>;
  }[];
}

interface SearchResult<T> {
  hits: {
    total: number;
    items: T[];
  };
  aggregations?: Record<string, any>;
  page?: {
    current: number;
    total: number;
    size: number;
  };
  took: number;
}

interface SearchIndex {
  name: string;
  mapping: Record<string, {
    type: string;
    analyzer?: string;
    searchAnalyzer?: string;
    fields?: Record<string, {
      type: string;
      analyzer?: string;
    }>;
  }>;
  settings?: {
    numberOfShards?: number;
    numberOfReplicas?: number;
    analysis?: {
      analyzer?: Record<string, any>;
      tokenizer?: Record<string, any>;
      filter?: Record<string, any>;
    };
  };
}

class SearchService extends EventEmitter {
  private static instance: SearchService;
  private indices: Map<string, SearchIndex> = new Map();
  private data: Map<string, any[]> = new Map();
  private vectorStore: Map<string, Float32Array[]> = new Map();

  private constructor() {
    super();
    this.setupDefaultIndices();
  }

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  private setupDefaultIndices() {
    // Users index
    this.createIndex({
      name: 'users',
      mapping: {
        username: { type: 'keyword' },
        email: { type: 'keyword' },
        displayName: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword' },
            ngram: {
              type: 'text',
              analyzer: 'ngram_analyzer'
            }
          }
        },
        bio: { type: 'text', analyzer: 'standard' },
        tags: { type: 'keyword' },
        createdAt: { type: 'date' },
        lastActive: { type: 'date' }
      },
      settings: {
        analysis: {
          analyzer: {
            ngram_analyzer: {
              type: 'custom',
              tokenizer: 'ngram_tokenizer',
              filter: ['lowercase']
            }
          },
          tokenizer: {
            ngram_tokenizer: {
              type: 'ngram',
              min_gram: 2,
              max_gram: 3
            }
          }
        }
      }
    });

    // Content index
    this.createIndex({
      name: 'content',
      mapping: {
        title: {
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword' },
            ngram: {
              type: 'text',
              analyzer: 'ngram_analyzer'
            }
          }
        },
        description: { type: 'text', analyzer: 'standard' },
        tags: { type: 'keyword' },
        category: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        authorId: { type: 'keyword' },
        status: { type: 'keyword' },
        contentType: { type: 'keyword' },
        embedding: { type: 'dense_vector', dims: 384 }
      }
    });
  }

  createIndex(index: SearchIndex) {
    if (this.indices.has(index.name)) {
      throw new Error(`Index ${index.name} already exists`);
    }
    this.indices.set(index.name, index);
    this.data.set(index.name, []);
    this.vectorStore.set(index.name, []);
  }

  async index<T extends Record<string, any>>(
    indexName: string,
    documents: T[],
    options: {
      generateEmbeddings?: boolean;
    } = {}
  ) {
    return tracingService.trace('search.index', async (span) => {
      try {
        const index = this.indices.get(indexName);
        if (!index) {
          throw new Error(`Index ${indexName} not found`);
        }

        span.setAttributes({
          'index.name': indexName,
          'documents.count': documents.length
        });

        // Validate documents against mapping
        documents.forEach(doc => this.validateDocument(doc, index.mapping));

        // Generate embeddings if needed
        if (options.generateEmbeddings && index.mapping.embedding) {
          const embeddings = await this.generateEmbeddings(documents);
          documents.forEach((doc, i) => {
            doc.embedding = embeddings[i];
          });
        }

        // Store documents
        const existingData = this.data.get(indexName) || [];
        this.data.set(indexName, [...existingData, ...documents]);

        // Store embeddings separately for vector search
        if (options.generateEmbeddings) {
          const existingVectors = this.vectorStore.get(indexName) || [];
          const newVectors = documents.map(doc => doc.embedding);
          this.vectorStore.set(indexName, [...existingVectors, ...newVectors]);
        }

        this.emit('documents_indexed', {
          index: indexName,
          count: documents.length
        });

        return documents.length;
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'SearchService',
          action: 'index',
          indexName
        });
        throw error;
      }
    });
  }

  private validateDocument(doc: Record<string, any>, mapping: SearchIndex['mapping']) {
    for (const [field, config] of Object.entries(mapping)) {
      if (doc[field] !== undefined) {
        // Type validation
        switch (config.type) {
          case 'keyword':
          case 'text':
            if (typeof doc[field] !== 'string') {
              throw new Error(`Field ${field} must be a string`);
            }
            break;
          case 'date':
            if (!(doc[field] instanceof Date || typeof doc[field] === 'number')) {
              throw new Error(`Field ${field} must be a Date or timestamp`);
            }
            break;
          case 'dense_vector':
            if (!Array.isArray(doc[field]) || doc[field].length !== config.dims) {
              throw new Error(`Field ${field} must be a vector of length ${config.dims}`);
            }
            break;
        }
      }
    }
  }

  private async generateEmbeddings(documents: Record<string, any>[]): Promise<Float32Array[]> {
    // This would typically call an external embedding service
    // For now, return mock embeddings
    return documents.map(() => new Float32Array(384).fill(0));
  }

  async search<T>(indexName: string, options: SearchOptions): Promise<SearchResult<T>> {
    return tracingService.trace('search.query', async (span) => {
      try {
        const index = this.indices.get(indexName);
        if (!index) {
          throw new Error(`Index ${indexName} not found`);
        }

        span.setAttributes({
          'index.name': indexName,
          'search.type': options.searchType,
          'search.query': options.query
        });

        const startTime = Date.now();
        let results = this.data.get(indexName) || [];

        // Apply search
        switch (options.searchType) {
          case 'exact':
            results = this.exactSearch(results, options);
            break;
          case 'fuzzy':
            results = this.fuzzySearch(results, options);
            break;
          case 'semantic':
            results = await this.semanticSearch(indexName, results, options);
            break;
          default:
            results = this.defaultSearch(results, options);
        }

        // Apply filters
        if (options.filters) {
          results = this.applyFilters(results, options.filters);
        }

        // Apply sorting
        if (options.sort) {
          results = this.applySorting(results, options.sort);
        }

        // Calculate aggregations
        const aggregations = options.aggregations
          ? this.calculateAggregations(results, options.aggregations)
          : undefined;

        // Apply pagination
        const page = options.page || 1;
        const limit = options.limit || 10;
        const total = results.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        results = results.slice(start, end);

        // Select fields
        if (options.includeFields || options.excludeFields) {
          results = this.selectFields(results, options.includeFields, options.excludeFields);
        }

        const searchResult: SearchResult<T> = {
          hits: {
            total,
            items: results as T[]
          },
          page: {
            current: page,
            total: Math.ceil(total / limit),
            size: limit
          },
          took: Date.now() - startTime
        };

        if (aggregations) {
          searchResult.aggregations = aggregations;
        }

        return searchResult;
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'SearchService',
          action: 'search',
          indexName,
          query: options.query
        });
        throw error;
      }
    });
  }

  private exactSearch(data: any[], options: SearchOptions): any[] {
    return data.filter(item => {
      return Object.entries(item).some(([field, value]) => {
        if (typeof value === 'string') {
          return value.toLowerCase() === options.query.toLowerCase();
        }
        return false;
      });
    });
  }

  private fuzzySearch(data: any[], options: SearchOptions): any[] {
    const threshold = options.fuzzyThreshold || 0.2;
    return data.filter(item => {
      return Object.entries(item).some(([field, value]) => {
        if (typeof value === 'string') {
          return this.calculateLevenshteinDistance(
            value.toLowerCase(),
            options.query.toLowerCase()
          ) <= threshold * Math.max(value.length, options.query.length);
        }
        return false;
      });
    });
  }

  private async semanticSearch(indexName: string, data: any[], options: SearchOptions): Promise<any[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbeddings([{ text: options.query }]);
    const vectors = this.vectorStore.get(indexName) || [];

    // Calculate cosine similarity with all vectors
    const similarities = vectors.map(vector => 
      this.calculateCosineSimilarity(queryEmbedding[0], vector)
    );

    // Sort data by similarity
    return data
      .map((item, index) => ({ item, similarity: similarities[index] }))
      .sort((a, b) => b.similarity - a.similarity)
      .map(({ item }) => item);
  }

  private defaultSearch(data: any[], options: SearchOptions): any[] {
    const query = options.query.toLowerCase();
    return data.filter(item => {
      return Object.entries(item).some(([field, value]) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(query);
        }
        return false;
      });
    });
  }

  private applyFilters(data: any[], filters: Record<string, any>): any[] {
    return data.filter(item => {
      return Object.entries(filters).every(([field, value]) => {
        if (Array.isArray(value)) {
          return value.includes(item[field]);
        }
        if (typeof value === 'object') {
          const { gt, gte, lt, lte } = value;
          const itemValue = item[field];
          if (gt !== undefined && !(itemValue > gt)) return false;
          if (gte !== undefined && !(itemValue >= gte)) return false;
          if (lt !== undefined && !(itemValue < lt)) return false;
          if (lte !== undefined && !(itemValue <= lte)) return false;
          return true;
        }
        return item[field] === value;
      });
    });
  }

  private applySorting(data: any[], sort: SearchOptions['sort']): any[] {
    if (!sort) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];
      const order = sort.order === 'desc' ? -1 : 1;

      if (aValue < bValue) return -1 * order;
      if (aValue > bValue) return 1 * order;
      return 0;
    });
  }

  private calculateAggregations(
    data: any[],
    aggregations: SearchOptions['aggregations']
  ): Record<string, any> {
    if (!aggregations) return {};

    return aggregations.reduce((acc, agg) => {
      switch (agg.type) {
        case 'terms':
          acc[agg.field] = this.termsAggregation(data, agg.field);
          break;
        case 'range':
          acc[agg.field] = this.rangeAggregation(data, agg.field, agg.options);
          break;
        case 'date_histogram':
          acc[agg.field] = this.dateHistogramAggregation(data, agg.field, agg.options);
          break;
      }
      return acc;
    }, {});
  }

  private termsAggregation(data: any[], field: string): Record<string, number> {
    return data.reduce((acc, item) => {
      const value = item[field];
      if (value !== undefined) {
        acc[value] = (acc[value] || 0) + 1;
      }
      return acc;
    }, {});
  }

  private rangeAggregation(
    data: any[],
    field: string,
    options: { ranges: Array<{ from?: number; to?: number }> }
  ): Array<{ range: string; count: number }> {
    return options.ranges.map(range => ({
      range: `${range.from || '*'}-${range.to || '*'}`,
      count: data.filter(item => {
        const value = item[field];
        if (range.from !== undefined && value < range.from) return false;
        if (range.to !== undefined && value >= range.to) return false;
        return true;
      }).length
    }));
  }

  private dateHistogramAggregation(
    data: any[],
    field: string,
    options: { interval: string }
  ): Array<{ date: string; count: number }> {
    const dates = data
      .map(item => new Date(item[field]))
      .filter(date => !isNaN(date.getTime()));

    const intervals: Record<string, number> = {};
    dates.forEach(date => {
      let key: string;
      switch (options.interval) {
        case 'year':
          key = date.getFullYear().toString();
          break;
        case 'month':
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        default:
          key = date.toISOString();
      }
      intervals[key] = (intervals[key] || 0) + 1;
    });

    return Object.entries(intervals)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private selectFields(
    data: any[],
    includeFields?: string[],
    excludeFields?: string[]
  ): any[] {
    return data.map(item => {
      const result: Record<string, any> = {};
      
      if (includeFields) {
        includeFields.forEach(field => {
          if (item[field] !== undefined) {
            result[field] = item[field];
          }
        });
      } else {
        Object.assign(result, item);
        if (excludeFields) {
          excludeFields.forEach(field => {
            delete result[field];
          });
        }
      }

      return result;
    });
  }

  private calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Cleanup
  async cleanup() {
    this.indices.clear();
    this.data.clear();
    this.vectorStore.clear();
  }
}

// Export singleton instance
export const searchService = SearchService.getInstance(); 