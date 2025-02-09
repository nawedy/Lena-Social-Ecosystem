import { EventEmitter } from 'events';
import { ResourceOptimizer } from '../optimization/ResourceOptimizer';

interface PoolConfig {
  minSize: number;
  maxSize: number;
  acquireTimeout: number;
  idleTimeout: number;
  validateOnBorrow: boolean;
}

interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalCreated: number;
  totalDestroyed: number;
}

class PoolConnection {
  private lastUsed: number = Date.now();
  private isValid: boolean = true;

  constructor(
    public connection: any,
    private validateFn?: (conn: any) => Promise<boolean>
  ) {}

  async validate(): Promise<boolean> {
    if (!this.validateFn) return true;
    try {
      this.isValid = await this.validateFn(this.connection);
      return this.isValid;
    } catch (error) {
      this.isValid = false;
      return false;
    }
  }

  isExpired(idleTimeout: number): boolean {
    return Date.now() - this.lastUsed > idleTimeout;
  }

  markUsed(): void {
    this.lastUsed = Date.now();
  }

  invalidate(): void {
    this.isValid = false;
  }
}

export class ConnectionPool extends EventEmitter {
  private connections: PoolConnection[] = [];
  private waitingRequests: Array<{
    resolve: (connection: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private metrics: PoolMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalCreated: 0,
    totalDestroyed: 0
  };
  private maintenanceInterval: NodeJS.Timer;
  private resourceOptimizer: ResourceOptimizer;

  constructor(
    private config: PoolConfig,
    private createConnection: () => Promise<any>,
    private destroyConnection: (connection: any) => Promise<void>,
    resourceOptimizer?: ResourceOptimizer
  ) {
    super();
    this.resourceOptimizer = resourceOptimizer || new ResourceOptimizer({
      autoScale: true,
      resourceLimits: {
        maxMemory: 1024 * 1024 * 1024, // 1GB
        maxConcurrentRequests: 1000,
        maxBatchSize: 100
      },
      throttling: {
        enabled: true,
        threshold: 1000,
        cooldown: 5000
      }
    });
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Create initial connections
    for (let i = 0; i < this.config.minSize; i++) {
      await this.createNewConnection();
    }

    // Start maintenance interval
    this.maintenanceInterval = setInterval(
      () => this.maintenance(),
      30000 // Run every 30 seconds
    );
  }

  async acquire(): Promise<any> {
    // Try to get an idle connection
    const connection = this.getIdleConnection();
    if (connection) {
      return this.prepareConnection(connection);
    }

    // Create new connection if possible
    if (this.connections.length < this.config.maxSize) {
      const newConn = await this.createNewConnection();
      return this.prepareConnection(newConn);
    }

    // Wait for a connection
    return this.waitForConnection();
  }

  async release(connection: any): Promise<void> {
    const poolConn = this.connections.find(c => c.connection === connection);
    if (!poolConn) {
      throw new Error('Connection not found in pool');
    }

    poolConn.markUsed();
    this.metrics.activeConnections--;
    this.metrics.idleConnections++;

    // Check waiting requests
    if (this.waitingRequests.length > 0) {
      const request = this.waitingRequests.shift()!;
      clearTimeout(request.timeout);
      this.metrics.waitingRequests--;
      request.resolve(connection);
    }
  }

  private getIdleConnection(): PoolConnection | undefined {
    return this.connections.find(conn => 
      !conn.isExpired(this.config.idleTimeout) && 
      conn.validate()
    );
  }

  private async createNewConnection(): Promise<PoolConnection> {
    const connection = await this.createConnection();
    const poolConn = new PoolConnection(
      connection,
      this.config.validateOnBorrow ? this.validateConnection : undefined
    );
    this.connections.push(poolConn);
    this.metrics.totalCreated++;
    return poolConn;
  }

  private async prepareConnection(poolConn: PoolConnection): Promise<any> {
    if (this.config.validateOnBorrow) {
      const isValid = await poolConn.validate();
      if (!isValid) {
        await this.removeConnection(poolConn);
        return this.acquire();
      }
    }

    poolConn.markUsed();
    this.metrics.activeConnections++;
    this.metrics.idleConnections--;
    return poolConn.connection;
  }

  private waitForConnection(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingRequests.findIndex(
          r => r.resolve === resolve
        );
        if (index !== -1) {
          this.waitingRequests.splice(index, 1);
          this.metrics.waitingRequests--;
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitingRequests.push({ resolve, reject, timeout });
      this.metrics.waitingRequests++;
    });
  }

  private async maintenance(): Promise<void> {
    // Remove expired connections
    const now = Date.now();
    const expiredConnections = this.connections.filter(conn =>
      conn.isExpired(this.config.idleTimeout)
    );

    // Keep at least minSize connections
    const removeCount = Math.min(
      expiredConnections.length,
      this.connections.length - this.config.minSize
    );

    for (let i = 0; i < removeCount; i++) {
      await this.removeConnection(expiredConnections[i]);
    }

    // Emit metrics
    this.emit('metrics', this.getMetrics());
  }

  private async removeConnection(poolConn: PoolConnection): Promise<void> {
    const index = this.connections.indexOf(poolConn);
    if (index !== -1) {
      this.connections.splice(index, 1);
      await this.destroyConnection(poolConn.connection);
      this.metrics.totalDestroyed++;
    }
  }

  private async validateConnection(connection: any): Promise<boolean> {
    try {
      // Implement connection validation logic
      // For example: await connection.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  async close(): Promise<void> {
    clearInterval(this.maintenanceInterval);
    
    // Destroy all connections
    await Promise.all(
      this.connections.map(conn => this.destroyConnection(conn.connection))
    );
    
    this.connections = [];
    this.waitingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Pool is closing'));
    });
    this.waitingRequests = [];
  }
} 