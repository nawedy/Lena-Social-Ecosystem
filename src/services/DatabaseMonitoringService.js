import db from '../db/connection.js';

class DatabaseMonitoringService {
  static instance;
  metricsInterval;

  constructor() {
    this.metricsInterval = null;
  }

  static getInstance() {
    if (!DatabaseMonitoringService.instance) {
      DatabaseMonitoringService.instance = new DatabaseMonitoringService();
    }
    return DatabaseMonitoringService.instance;
  }

  async start() {
    // Start collecting metrics every 5 minutes
    this.metricsInterval = setInterval(() => this.collectMetrics(), 5 * 60 * 1000);
    
    // Collect initial metrics
    await this.collectMetrics();
    console.log('Database monitoring service started');
  }

  async stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    console.log('Database monitoring service stopped');
  }

  async collectMetrics() {
    try {
      await this.collectConnectionPoolMetrics();
      await this.collectDatabaseSizeMetrics();
      await this.collectTableStatistics();
    } catch (error) {
      console.error('Error collecting database metrics:', error);
      await this.recordError(error);
    }
  }

  async collectConnectionPoolMetrics() {
    const { rows: [metrics] } = await db.query(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Client') as waiting_clients
    `);

    await db.query(`
      INSERT INTO connection_pool_metrics (
        total_connections,
        active_connections,
        idle_connections,
        waiting_clients
      ) VALUES ($1, $2, $3, $4)
    `, [
      metrics.total_connections,
      metrics.active_connections,
      metrics.idle_connections,
      metrics.waiting_clients
    ]);
  }

  async collectDatabaseSizeMetrics() {
    const { rows: [metrics] } = await db.query(`
      SELECT
        current_database() as database_name,
        pg_database_size(current_database()) as size_bytes,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as index_count
    `);

    await db.query(`
      INSERT INTO database_size_metrics (
        database_name,
        size_bytes,
        table_count,
        index_count
      ) VALUES ($1, $2, $3, $4)
    `, [
      metrics.database_name,
      metrics.size_bytes,
      metrics.table_count,
      metrics.index_count
    ]);
  }

  async collectTableStatistics() {
    const { rows: tables } = await db.query(`
      SELECT 
        relname as table_name,
        n_live_tup as row_count,
        pg_total_relation_size(quote_ident(relname)) as total_size_bytes,
        pg_indexes_size(quote_ident(relname)) as index_size_bytes,
        vacuum_count,
        autovacuum_count,
        analyze_count,
        autoanalyze_count,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    `);

    for (const table of tables) {
      await db.query(`
        INSERT INTO table_statistics (
          table_name,
          row_count,
          total_size_bytes,
          index_size_bytes,
          vacuum_count,
          analyze_count,
          last_vacuum,
          last_analyze
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        table.table_name,
        table.row_count,
        table.total_size_bytes,
        table.index_size_bytes,
        table.vacuum_count + table.autovacuum_count,
        table.analyze_count + table.autoanalyze_count,
        table.last_vacuum || table.last_autovacuum,
        table.last_analyze || table.last_autoanalyze
      ]);
    }
  }

  async recordQueryPerformance(queryText, executionTimeMs, rowsAffected, clientInfo = {}) {
    try {
      await db.query(
        'SELECT record_query_performance($1, $2, $3, $4)',
        [queryText, executionTimeMs, rowsAffected, JSON.stringify(clientInfo)]
      );
    } catch (error) {
      console.error('Error recording query performance:', error);
      await this.recordError(error);
    }
  }

  async recordError(error, queryText = null, clientInfo = {}) {
    try {
      await db.query(`
        INSERT INTO database_errors (
          error_code,
          error_message,
          query_text,
          stack_trace,
          client_info
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        error.code,
        error.message,
        queryText,
        error.stack,
        JSON.stringify(clientInfo)
      ]);
    } catch (insertError) {
      console.error('Error recording database error:', insertError);
    }
  }
}

export default DatabaseMonitoringService.getInstance();
