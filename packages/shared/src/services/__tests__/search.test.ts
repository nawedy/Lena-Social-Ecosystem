import { searchService } from '../search/SearchService';

describe('Search Service', () => {
  beforeEach(async () => {
    await searchService.cleanup();
  });

  describe('Index Management', () => {
    it('should create new indices', () => {
      searchService.createIndex({
        name: 'test_index',
        mapping: {
          title: { type: 'text' },
          tags: { type: 'keyword' }
        }
      });

      expect(() => {
        searchService.createIndex({
          name: 'test_index',
          mapping: {}
        });
      }).toThrow('Index test_index already exists');
    });

    it('should validate document fields', async () => {
      searchService.createIndex({
        name: 'test_index',
        mapping: {
          title: { type: 'text' },
          count: { type: 'number' },
          date: { type: 'date' }
        }
      });

      await expect(searchService.index('test_index', [{
        title: 123, // Should be string
        count: 'invalid', // Should be number
        date: 'invalid' // Should be Date or timestamp
      }])).rejects.toThrow('Field title must be a string');
    });
  });

  describe('Document Indexing', () => {
    beforeEach(() => {
      searchService.createIndex({
        name: 'test_index',
        mapping: {
          title: { type: 'text' },
          description: { type: 'text' },
          tags: { type: 'keyword' },
          createdAt: { type: 'date' }
        }
      });
    });

    it('should index documents', async () => {
      const docs = [
        {
          title: 'Test Document',
          description: 'This is a test',
          tags: ['test'],
          createdAt: new Date()
        }
      ];

      const count = await searchService.index('test_index', docs);
      expect(count).toBe(1);
    });

    it('should handle vector embeddings', async () => {
      searchService.createIndex({
        name: 'vector_index',
        mapping: {
          title: { type: 'text' },
          embedding: { type: 'dense_vector', dims: 384 }
        }
      });

      const docs = [
        { title: 'Test Document' }
      ];

      await searchService.index('vector_index', docs, {
        generateEmbeddings: true
      });

      // Verify embeddings were generated
      const results = await searchService.search('vector_index', {
        query: 'test',
        searchType: 'semantic'
      });

      expect(results.hits.total).toBe(1);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      searchService.createIndex({
        name: 'test_index',
        mapping: {
          title: { type: 'text' },
          description: { type: 'text' },
          tags: { type: 'keyword' },
          category: { type: 'keyword' },
          createdAt: { type: 'date' }
        }
      });

      await searchService.index('test_index', [
        {
          title: 'First Document',
          description: 'This is the first test document',
          tags: ['test', 'first'],
          category: 'A',
          createdAt: new Date('2023-01-01')
        },
        {
          title: 'Second Document',
          description: 'This is the second test document',
          tags: ['test', 'second'],
          category: 'B',
          createdAt: new Date('2023-02-01')
        },
        {
          title: 'Third Document',
          description: 'This is another document',
          tags: ['other'],
          category: 'A',
          createdAt: new Date('2023-03-01')
        }
      ]);
    });

    it('should perform exact search', async () => {
      const results = await searchService.search('test_index', {
        query: 'First Document',
        searchType: 'exact'
      });

      expect(results.hits.total).toBe(1);
      expect(results.hits.items[0].title).toBe('First Document');
    });

    it('should perform fuzzy search', async () => {
      const results = await searchService.search('test_index', {
        query: 'Frist Document', // Intentional typo
        searchType: 'fuzzy',
        fuzzyThreshold: 0.3
      });

      expect(results.hits.total).toBe(1);
      expect(results.hits.items[0].title).toBe('First Document');
    });

    it('should perform semantic search', async () => {
      const results = await searchService.search('test_index', {
        query: 'initial document',
        searchType: 'semantic'
      });

      expect(results.hits.total).toBeGreaterThan(0);
    });

    it('should apply filters', async () => {
      const results = await searchService.search('test_index', {
        query: 'document',
        filters: {
          category: 'A',
          tags: ['test']
        }
      });

      expect(results.hits.total).toBe(1);
      expect(results.hits.items[0].title).toBe('First Document');
    });

    it('should apply range filters', async () => {
      const results = await searchService.search('test_index', {
        query: 'document',
        filters: {
          createdAt: {
            gte: new Date('2023-02-01'),
            lt: new Date('2023-04-01')
          }
        }
      });

      expect(results.hits.total).toBe(2);
    });

    it('should sort results', async () => {
      const results = await searchService.search('test_index', {
        query: 'document',
        sort: {
          field: 'createdAt',
          order: 'desc'
        }
      });

      expect(results.hits.items[0].title).toBe('Third Document');
    });

    it('should paginate results', async () => {
      const results = await searchService.search('test_index', {
        query: 'document',
        page: 2,
        limit: 1
      });

      expect(results.hits.items.length).toBe(1);
      expect(results.page?.current).toBe(2);
      expect(results.page?.total).toBe(3);
    });

    it('should select specific fields', async () => {
      const results = await searchService.search('test_index', {
        query: 'document',
        includeFields: ['title', 'category']
      });

      expect(Object.keys(results.hits.items[0])).toEqual(['title', 'category']);
    });

    it('should exclude specific fields', async () => {
      const results = await searchService.search('test_index', {
        query: 'document',
        excludeFields: ['description', 'createdAt']
      });

      expect(Object.keys(results.hits.items[0])).not.toContain('description');
      expect(Object.keys(results.hits.items[0])).not.toContain('createdAt');
    });
  });

  describe('Aggregations', () => {
    beforeEach(async () => {
      searchService.createIndex({
        name: 'test_index',
        mapping: {
          category: { type: 'keyword' },
          price: { type: 'number' },
          createdAt: { type: 'date' }
        }
      });

      await searchService.index('test_index', [
        { category: 'A', price: 10, createdAt: new Date('2023-01-01') },
        { category: 'A', price: 20, createdAt: new Date('2023-02-01') },
        { category: 'B', price: 30, createdAt: new Date('2023-03-01') },
        { category: 'B', price: 40, createdAt: new Date('2023-04-01') }
      ]);
    });

    it('should calculate terms aggregation', async () => {
      const results = await searchService.search('test_index', {
        query: '*',
        aggregations: [{
          field: 'category',
          type: 'terms'
        }]
      });

      expect(results.aggregations?.category).toEqual({
        'A': 2,
        'B': 2
      });
    });

    it('should calculate range aggregation', async () => {
      const results = await searchService.search('test_index', {
        query: '*',
        aggregations: [{
          field: 'price',
          type: 'range',
          options: {
            ranges: [
              { to: 20 },
              { from: 20, to: 40 },
              { from: 40 }
            ]
          }
        }]
      });

      expect(results.aggregations?.price).toEqual([
        { range: '*-20', count: 1 },
        { range: '20-40', count: 2 },
        { range: '40-*', count: 1 }
      ]);
    });

    it('should calculate date histogram aggregation', async () => {
      const results = await searchService.search('test_index', {
        query: '*',
        aggregations: [{
          field: 'createdAt',
          type: 'date_histogram',
          options: {
            interval: 'month'
          }
        }]
      });

      expect(results.aggregations?.createdAt).toHaveLength(4); // One per month
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid index names', async () => {
      await expect(searchService.search('nonexistent_index', {
        query: 'test'
      })).rejects.toThrow('Index nonexistent_index not found');
    });

    it('should handle invalid search options', async () => {
      searchService.createIndex({
        name: 'test_index',
        mapping: {
          title: { type: 'text' }
        }
      });

      await expect(searchService.search('test_index', {
        query: '',
        sort: {
          field: 'nonexistent_field',
          order: 'asc'
        }
      })).resolves.toEqual(expect.objectContaining({
        hits: expect.objectContaining({
          total: 0,
          items: []
        })
      }));
    });
  });

  describe('Performance', () => {
    it('should handle large result sets efficiently', async () => {
      searchService.createIndex({
        name: 'large_index',
        mapping: {
          title: { type: 'text' }
        }
      });

      // Index 1000 documents
      const docs = Array.from({ length: 1000 }, (_, i) => ({
        title: `Document ${i}`
      }));

      await searchService.index('large_index', docs);

      const startTime = Date.now();
      const results = await searchService.search('large_index', {
        query: 'document',
        page: 1,
        limit: 10
      });

      expect(results.took).toBeLessThan(100); // Should take less than 100ms
      expect(results.hits.total).toBe(1000);
      expect(results.hits.items).toHaveLength(10);
    });
  });
}); 