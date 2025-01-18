import { BskyAgent } from '@atproto/api';

export interface InventoryTransaction {
  uri: string;
  cid: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return' | 'loss';
  productId: string;
  quantity: number;
  locationId: string;
  reference?: {
    type: 'order' | 'return' | 'transfer' | 'adjustment';
    uri: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface InventorySnapshot {
  uri: string;
  cid: string;
  productId: string;
  locationId: string;
  quantity: number;
  value: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: string;
}

export interface InventoryForecast {
  productId: string;
  locationId: string;
  predictions: Array<{
    date: string;
    expectedDemand: number;
    recommendedStock: number;
    confidence: number;
  }>;
  seasonalFactors: Array<{
    period: string;
    factor: number;
  }>;
  trends: Array<{
    type: string;
    impact: number;
    description: string;
  }>;
}

export interface InventoryAlert {
  uri: string;
  cid: string;
  type:
    | 'low_stock'
    | 'stockout_risk'
    | 'excess_stock'
    | 'slow_moving'
    | 'expiration_risk';
  severity: 'low' | 'medium' | 'high';
  productId: string;
  locationId: string;
  message: string;
  recommendation?: string;
  createdAt: string;
  resolvedAt?: string;
}

export class ATProtocolInventoryTracking {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Transaction Recording
  public async recordTransaction(params: {
    type: InventoryTransaction['type'];
    productId: string;
    quantity: number;
    locationId: string;
    reference?: InventoryTransaction['reference'];
    metadata?: Record<string, any>;
  }): Promise<InventoryTransaction> {
    const record = {
      $type: 'app.bsky.commerce.inventoryTransaction',
      ...params,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.inventoryTransaction',
      record,
    });

    // Update inventory snapshot
    await this.updateInventorySnapshot(
      params.productId,
      params.locationId,
      params.quantity
    );

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  // Snapshot Management
  private async updateInventorySnapshot(
    productId: string,
    locationId: string,
    quantityChange: number
  ): Promise<InventorySnapshot> {
    const currentSnapshot = await this.getInventorySnapshot(
      productId,
      locationId
    );

    const updatedSnapshot = {
      $type: 'app.bsky.commerce.inventorySnapshot',
      productId,
      locationId,
      quantity: currentSnapshot
        ? currentSnapshot.quantity + quantityChange
        : quantityChange,
      value: await this.calculateInventoryValue(productId, quantityChange),
      lowStockThreshold: currentSnapshot?.lowStockThreshold ?? 10,
      reorderPoint: currentSnapshot?.reorderPoint ?? 5,
      reorderQuantity: currentSnapshot?.reorderQuantity ?? 20,
      lastUpdated: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.inventorySnapshot',
      rkey: `${productId}-${locationId}`,
      record: updatedSnapshot,
    });

    // Check for alerts
    await this.checkAndCreateAlerts(updatedSnapshot);

    return {
      uri: response.uri,
      cid: response.cid,
      ...updatedSnapshot,
    };
  }

  // Forecasting
  public async generateForecast(params: {
    productId: string;
    locationId: string;
    days: number;
  }): Promise<InventoryForecast> {
    // Get historical data
    const transactions = await this.getTransactionHistory(
      params.productId,
      params.locationId
    );
    const snapshot = await this.getInventorySnapshot(
      params.productId,
      params.locationId
    );

    // Calculate seasonal patterns and trends
    const seasonalFactors = await this.calculateSeasonalFactors(transactions);
    const trends = await this.analyzeTrends(transactions);

    // Generate daily predictions
    const predictions = await this.generateDailyPredictions({
      transactions,
      snapshot,
      seasonalFactors,
      trends,
      days: params.days,
    });

    return {
      productId: params.productId,
      locationId: params.locationId,
      predictions,
      seasonalFactors,
      trends,
    };
  }

  // Alert Management
  private async checkAndCreateAlerts(
    snapshot: InventorySnapshot
  ): Promise<void> {
    const alerts: Omit<InventoryAlert, 'uri' | 'cid'>[] = [];

    // Check for low stock
    if (snapshot.quantity <= snapshot.lowStockThreshold) {
      alerts.push({
        type: 'low_stock',
        severity:
          snapshot.quantity <= snapshot.reorderPoint ? 'high' : 'medium',
        productId: snapshot.productId,
        locationId: snapshot.locationId,
        message: `Low stock alert: ${snapshot.quantity} units remaining`,
        recommendation: `Reorder ${snapshot.reorderQuantity} units`,
        createdAt: new Date().toISOString(),
      });
    }

    // Check for stockout risk
    const forecast = await this.generateForecast({
      productId: snapshot.productId,
      locationId: snapshot.locationId,
      days: 7,
    });

    const stockoutRisk = forecast.predictions.some(
      p => p.expectedDemand > snapshot.quantity
    );
    if (stockoutRisk) {
      alerts.push({
        type: 'stockout_risk',
        severity: 'high',
        productId: snapshot.productId,
        locationId: snapshot.locationId,
        message: 'Risk of stockout within 7 days',
        recommendation: 'Expedite reorder or transfer inventory',
        createdAt: new Date().toISOString(),
      });
    }

    // Create alert records
    await Promise.all(
      alerts.map(alert =>
        this.agent.api.com.atproto.repo.createRecord({
          repo: this.agent.session?.did ?? '',
          collection: 'app.bsky.commerce.inventoryAlert',
          record: {
            $type: 'app.bsky.commerce.inventoryAlert',
            ...alert,
          },
        })
      )
    );
  }

  // Analytics
  public async getInventoryAnalytics(params: {
    timeframe: {
      start: string;
      end: string;
    };
    productId?: string;
    locationId?: string;
  }): Promise<{
    turnoverRate: number;
    stockoutRate: number;
    accuracyRate: number;
    valueByProduct: Record<string, number>;
    movementByLocation: Record<
      string,
      {
        in: number;
        out: number;
      }
    >;
    trends: Array<{
      metric: string;
      change: number;
      insight: string;
    }>;
  }> {
    const response =
      await this.agent.api.app.bsky.commerce.getInventoryAnalytics({
        timeframe: params.timeframe,
        productId: params.productId,
        locationId: params.locationId,
      });

    return response.data;
  }

  // Private Helper Methods
  private async getInventorySnapshot(
    productId: string,
    locationId: string
  ): Promise<InventorySnapshot | null> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.inventorySnapshot',
        rkey: `${productId}-${locationId}`,
      });

      return response.data.value as InventorySnapshot;
    } catch {
      return null;
    }
  }

  private async calculateInventoryValue(
    productId: string,
    quantityChange: number
  ): Promise<number> {
    // Get product price from product service
    const response = await this.agent.api.app.bsky.commerce.getProduct({
      uri: productId,
    });

    const price = response.data.price;
    return price * quantityChange;
  }

  private async getTransactionHistory(
    productId: string,
    locationId: string
  ): Promise<InventoryTransaction[]> {
    const response =
      await this.agent.api.app.bsky.commerce.listInventoryTransactions({
        productId,
        locationId,
        limit: 1000,
      });

    return response.data.transactions;
  }

  private async calculateSeasonalFactors(
    transactions: InventoryTransaction[]
  ): Promise<InventoryForecast['seasonalFactors']> {
    // Group transactions by month/day and calculate average demand
    const seasonalFactors: Record<string, number[]> = {};

    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const period = `${date.getMonth() + 1}-${date.getDate()}`;

      if (!seasonalFactors[period]) {
        seasonalFactors[period] = [];
      }

      seasonalFactors[period].push(transaction.quantity);
    });

    return Object.entries(seasonalFactors).map(([period, quantities]) => ({
      period,
      factor: quantities.reduce((a, b) => a + b, 0) / quantities.length,
    }));
  }

  private async analyzeTrends(
    transactions: InventoryTransaction[]
  ): Promise<InventoryForecast['trends']> {
    // Calculate various trends from transaction history
    const trends: InventoryForecast['trends'] = [];

    // Growth trend
    const growth = this.calculateGrowthTrend(transactions);
    if (Math.abs(growth) > 0.1) {
      trends.push({
        type: 'growth',
        impact: growth,
        description: `${growth > 0 ? 'Increasing' : 'Decreasing'} demand trend`,
      });
    }

    // Seasonality
    const seasonality = this.calculateSeasonality(transactions);
    if (seasonality > 0.2) {
      trends.push({
        type: 'seasonality',
        impact: seasonality,
        description: 'Strong seasonal pattern detected',
      });
    }

    return trends;
  }

  private calculateGrowthTrend(transactions: InventoryTransaction[]): number {
    // Simple linear regression on daily volumes
    const dailyVolumes = this.aggregateTransactionsByDay(transactions);
    const n = dailyVolumes.length;

    if (n < 2) return 0;

    const xMean = (n - 1) / 2;
    const yMean = dailyVolumes.reduce((a, b) => a + b, 0) / n;

    const slope =
      dailyVolumes.reduce((acc, y, x) => {
        return acc + (x - xMean) * (y - yMean);
      }, 0) /
      dailyVolumes.reduce((acc, _, x) => {
        return acc + Math.pow(x - xMean, 2);
      }, 0);

    return slope / yMean; // Normalized growth rate
  }

  private calculateSeasonality(transactions: InventoryTransaction[]): number {
    // Calculate coefficient of variation for each period
    const dailyVolumes = this.aggregateTransactionsByDay(transactions);
    const periodicVolumes: number[][] = Array(7)
      .fill(0)
      .map(() => []);

    dailyVolumes.forEach((volume, index) => {
      periodicVolumes[index % 7].push(volume);
    });

    const variations = periodicVolumes.map(volumes => {
      const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const variance =
        volumes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
        volumes.length;
      return Math.sqrt(variance) / mean; // Coefficient of variation
    });

    return Math.max(...variations);
  }

  private aggregateTransactionsByDay(
    transactions: InventoryTransaction[]
  ): number[] {
    const dailyVolumes: Record<string, number> = {};

    transactions.forEach(transaction => {
      const date = transaction.createdAt.split('T')[0];
      dailyVolumes[date] =
        (dailyVolumes[date] || 0) + Math.abs(transaction.quantity);
    });

    return Object.values(dailyVolumes);
  }

  private async generateDailyPredictions(params: {
    transactions: InventoryTransaction[];
    snapshot: InventorySnapshot | null;
    seasonalFactors: InventoryForecast['seasonalFactors'];
    trends: InventoryForecast['trends'];
    days: number;
  }): Promise<InventoryForecast['predictions']> {
    const predictions: InventoryForecast['predictions'] = [];
    const baselineDemand = this.calculateBaselineDemand(params.transactions);
    const growthTrend =
      params.trends.find(t => t.type === 'growth')?.impact ?? 0;

    for (let i = 0; i < params.days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      const seasonalFactor = this.getSeasonalFactor(
        date,
        params.seasonalFactors
      );
      const expectedDemand =
        baselineDemand * (1 + (growthTrend * i) / 365) * seasonalFactor;

      predictions.push({
        date: date.toISOString().split('T')[0],
        expectedDemand,
        recommendedStock: Math.ceil(expectedDemand * 1.2), // 20% safety stock
        confidence: this.calculateConfidence(
          expectedDemand,
          params.transactions
        ),
      });
    }

    return predictions;
  }

  private calculateBaselineDemand(
    transactions: InventoryTransaction[]
  ): number {
    // Calculate average daily demand from recent transactions
    const recentTransactions = transactions
      .filter(t => t.type === 'sale')
      .slice(-30);

    if (recentTransactions.length === 0) return 0;

    const totalDemand = recentTransactions.reduce(
      (sum, t) => sum + Math.abs(t.quantity),
      0
    );
    return totalDemand / 30; // Average daily demand
  }

  private getSeasonalFactor(
    date: Date,
    seasonalFactors: InventoryForecast['seasonalFactors']
  ): number {
    const period = `${date.getMonth() + 1}-${date.getDate()}`;
    const factor = seasonalFactors.find(f => f.period === period);
    return factor?.factor ?? 1;
  }

  private calculateConfidence(
    prediction: number,
    transactions: InventoryTransaction[]
  ): number {
    // Calculate confidence based on historical accuracy
    const recentPredictions = transactions
      .filter(t => t.metadata?.prediction)
      .slice(-30);

    if (recentPredictions.length === 0) return 0.7; // Default confidence

    const accuracies = recentPredictions.map(t => {
      const predicted = t.metadata?.prediction;
      const actual = Math.abs(t.quantity);
      return 1 - Math.abs(predicted - actual) / Math.max(predicted, actual);
    });

    return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  }
}
