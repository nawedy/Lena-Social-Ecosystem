import { Client } from '@elastic/elasticsearch';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import config from './env';

let elasticsearchContainer: StartedTestContainer;
let elasticsearchClient: Client;

/**
 * Start Elasticsearch container and create client
 */
export async function startElasticsearch(): Promise<void> {
  try {
    // Start Elasticsearch container
    elasticsearchContainer = await new GenericContainer('docker.elastic.co/elasticsearch/elasticsearch:8.12.0')
      .withExposedPorts(9200)
      .withEnvironment({
        'discovery.type': 'single-node',
        'xpack.security.enabled': 'false',
        'ES_JAVA_OPTS': '-Xms512m -Xmx512m'
      })
      .withStartupTimeout(120000)
      .withWaitStrategy(
        Wait.forLogMessage('started')
      )
      .start();

    // Update Elasticsearch configuration with container port
    const mappedPort = elasticsearchContainer.getMappedPort(9200);
    process.env.ELASTICSEARCH_NODE = `http://localhost:${mappedPort}`;

    // Create Elasticsearch client
    elasticsearchClient = new Client({
      node: process.env.ELASTICSEARCH_NODE,
      requestTimeout: 30000,
      maxRetries: 3
    });

    // Wait for Elasticsearch to be ready
    await waitForElasticsearch();

    console.log('Elasticsearch container started and client connected');
  } catch (error) {
    console.error('Failed to start Elasticsearch:', error);
    throw error;
  }
}

/**
 * Stop Elasticsearch container
 */
export async function stopElasticsearch(): Promise<void> {
  try {
    if (elasticsearchContainer) {
      await elasticsearchContainer.stop();
      console.log('Elasticsearch container stopped');
    }
  } catch (error) {
    console.error('Failed to stop Elasticsearch:', error);
    throw error;
  }
}

/**
 * Get Elasticsearch client instance
 */
export function getElasticsearchClient(): Client {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }
  return elasticsearchClient;
}

/**
 * Wait for Elasticsearch to be ready
 */
async function waitForElasticsearch(maxRetries: number = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const health = await elasticsearchClient.cluster.health();
      if (health.status === 'green' || health.status === 'yellow') {
        return;
      }
    } catch (error) {
      console.log(`Waiting for Elasticsearch to be ready (attempt ${i + 1}/${maxRetries})...`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Elasticsearch failed to become ready');
}

/**
 * Create test index with mappings
 */
export async function createTestIndex(
  indexName: string,
  mappings: Record<string, any>
): Promise<void> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    const indexExists = await elasticsearchClient.indices.exists({
      index: indexName
    });

    if (indexExists) {
      await elasticsearchClient.indices.delete({
        index: indexName
      });
    }

    await elasticsearchClient.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: mappings
        }
      }
    });

    console.log(`Created index: ${indexName}`);
  } catch (error) {
    console.error(`Failed to create index ${indexName}:`, error);
    throw error;
  }
}

/**
 * Index test documents
 */
export async function indexTestDocuments(
  indexName: string,
  documents: Record<string, any>[]
): Promise<void> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    const operations = documents.flatMap(doc => [
      { index: { _index: indexName } },
      doc
    ]);

    const { errors, items } = await elasticsearchClient.bulk({
      refresh: true,
      operations
    });

    if (errors) {
      const failedItems = items.filter(item => item.index?.error);
      console.error('Failed to index some documents:', failedItems);
      throw new Error('Bulk indexing failed');
    }

    console.log(`Indexed ${documents.length} documents to ${indexName}`);
  } catch (error) {
    console.error(`Failed to index documents to ${indexName}:`, error);
    throw error;
  }
}

/**
 * Search test documents
 */
export async function searchTestDocuments(
  indexName: string,
  query: Record<string, any>
): Promise<any[]> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    const response = await elasticsearchClient.search({
      index: indexName,
      body: query
    });

    return response.hits.hits.map(hit => ({
      _id: hit._id,
      ...hit._source
    }));
  } catch (error) {
    console.error(`Failed to search documents in ${indexName}:`, error);
    throw error;
  }
}

/**
 * Delete test documents
 */
export async function deleteTestDocuments(
  indexName: string,
  query: Record<string, any>
): Promise<void> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    await elasticsearchClient.deleteByQuery({
      index: indexName,
      body: {
        query
      }
    });

    console.log(`Deleted documents from ${indexName}`);
  } catch (error) {
    console.error(`Failed to delete documents from ${indexName}:`, error);
    throw error;
  }
}

/**
 * Clear test index
 */
export async function clearTestIndex(indexName: string): Promise<void> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    await elasticsearchClient.indices.delete({
      index: indexName,
      ignore_unavailable: true
    });

    console.log(`Cleared index: ${indexName}`);
  } catch (error) {
    console.error(`Failed to clear index ${indexName}:`, error);
    throw error;
  }
}

/**
 * Check Elasticsearch health
 */
export async function checkElasticsearchHealth(): Promise<boolean> {
  if (!elasticsearchClient) {
    return false;
  }

  try {
    const health = await elasticsearchClient.cluster.health();
    return health.status === 'green' || health.status === 'yellow';
  } catch {
    return false;
  }
}

/**
 * Get index settings
 */
export async function getIndexSettings(indexName: string): Promise<any> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    const response = await elasticsearchClient.indices.getSettings({
      index: indexName
    });

    return response[indexName].settings;
  } catch (error) {
    console.error(`Failed to get settings for index ${indexName}:`, error);
    throw error;
  }
}

/**
 * Update index settings
 */
export async function updateIndexSettings(
  indexName: string,
  settings: Record<string, any>
): Promise<void> {
  if (!elasticsearchClient) {
    throw new Error('Elasticsearch client not initialized');
  }

  try {
    await elasticsearchClient.indices.putSettings({
      index: indexName,
      body: settings
    });

    console.log(`Updated settings for index: ${indexName}`);
  } catch (error) {
    console.error(`Failed to update settings for index ${indexName}:`, error);
    throw error;
  }
} 