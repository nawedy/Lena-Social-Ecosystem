import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore, increment } from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';

interface UsageQuota {
  daily: number;
  monthly: number;
}

interface UsageStats {
  count: number;
  tokens: number;
  cost: number;
  lastUsed: Date;
}

export class APIUsageService {
  private static instance: APIUsageService;
  private db: FirebaseFirestore;

  private quotas: Record<string, UsageQuota> = {
    openai: { daily: 1000, monthly: 20000 },
    stability: { daily: 500, monthly: 10000 },
    replicate: { daily: 300, monthly: 5000 },
  };

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): APIUsageService {
    if (!APIUsageService.instance) {
      APIUsageService.instance = new APIUsageService();
    }
    return APIUsageService.instance;
  }

  async trackUsage(
    userId: string,
    provider: string,
    operation: string,
    tokens: number,
    cost: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const batch = this.db.batch();

    // Update daily usage
    const dailyRef = this.db
      .collection('usage')
      .doc(userId)
      .collection('daily')
      .doc(today);

    batch.set(
      dailyRef,
      {
        [`${provider}.${operation}`]: {
          count: increment(1),
          tokens: increment(tokens),
          cost: increment(cost),
          lastUsed: new Date(),
        },
      },
      { merge: true }
    );

    // Update monthly usage
    const monthlyRef = this.db
      .collection('usage')
      .doc(userId)
      .collection('monthly')
      .doc(month);

    batch.set(
      monthlyRef,
      {
        [`${provider}.${operation}`]: {
          count: increment(1),
          tokens: increment(tokens),
          cost: increment(cost),
          lastUsed: new Date(),
        },
      },
      { merge: true }
    );

    await batch.commit();
  }

  async checkQuota(userId: string, provider: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const [dailyUsage, monthlyUsage] = await Promise.all([
      this.db
        .collection('usage')
        .doc(userId)
        .collection('daily')
        .doc(today)
        .get(),
      this.db
        .collection('usage')
        .doc(userId)
        .collection('monthly')
        .doc(month)
        .get(),
    ]);

    const dailyTotal = this.calculateTotalUsage(dailyUsage.data()?.[provider]);
    const monthlyTotal = this.calculateTotalUsage(
      monthlyUsage.data()?.[provider]
    );

    return (
      dailyTotal < this.quotas[provider].daily &&
      monthlyTotal < this.quotas[provider].monthly
    );
  }

  async getUsageStats(
    userId: string,
    provider: string,
    period: 'daily' | 'monthly'
  ): Promise<Record<string, UsageStats>> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const docRef = this.db
      .collection('usage')
      .doc(userId)
      .collection(period)
      .doc(period === 'daily' ? today : month);

    const doc = await docRef.get();
    return doc.data()?.[provider] || {};
  }

  async updateQuota(
    provider: string,
    quotaType: 'daily' | 'monthly',
    value: number
  ): Promise<void> {
    this.quotas[provider][quotaType] = value;
    await SecureStore.setItemAsync(
      `quota_${provider}_${quotaType}`,
      value.toString()
    );
  }

  async getQuota(provider: string): Promise<UsageQuota> {
    return this.quotas[provider];
  }

  private calculateTotalUsage(
    usageData: Record<string, UsageStats> = {}
  ): number {
    return Object.values(usageData || {}).reduce(
      (total, stats) => total + stats.tokens,
      0
    );
  }

  async generateUsageReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const report = {
      summary: {
        totalCost: 0,
        totalTokens: 0,
        operationCount: 0,
      },
      providers: {} as Record<
        string,
        {
          cost: number;
          tokens: number;
          operations: number;
          breakdown: Record<string, UsageStats>;
        }
      >,
    };

    const usageQuery = this.db
      .collection('usage')
      .doc(userId)
      .collection('daily')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate);

    const snapshot = await usageQuery.get();

    snapshot.forEach(doc => {
      const data = doc.data();
      Object.entries(data).forEach(([provider, operations]) => {
        if (!report.providers[provider]) {
          report.providers[provider] = {
            cost: 0,
            tokens: 0,
            operations: 0,
            breakdown: {},
          };
        }

        Object.entries(operations as Record<string, UsageStats>).forEach(
          ([operation, stats]) => {
            report.summary.totalCost += stats.cost;
            report.summary.totalTokens += stats.tokens;
            report.summary.operationCount += stats.count;

            report.providers[provider].cost += stats.cost;
            report.providers[provider].tokens += stats.tokens;
            report.providers[provider].operations += stats.count;

            if (!report.providers[provider].breakdown[operation]) {
              report.providers[provider].breakdown[operation] = {
                count: 0,
                tokens: 0,
                cost: 0,
                lastUsed: stats.lastUsed,
              };
            }

            const breakdown = report.providers[provider].breakdown[operation];
            breakdown.count += stats.count;
            breakdown.tokens += stats.tokens;
            breakdown.cost += stats.cost;
            breakdown.lastUsed = new Date(
              Math.max(breakdown.lastUsed.getTime(), stats.lastUsed.getTime())
            );
          }
        );
      });
    });

    return report;
  }
}
