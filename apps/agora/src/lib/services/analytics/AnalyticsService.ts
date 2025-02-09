import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { performanceOptimizationService } from '../optimization/PerformanceOptimizationService';

interface MarketMetrics {
  totalListings: number;
  activeListings: number;
  totalSales: number;
  totalVolume: number;
  averagePrice: number;
  conversionRate: number;
  categoryDistribution: Record<string, number>;
  priceDistribution: Array<{
    range: string;
    count: number;
    volume: number;
  }>;
}

interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  buyerCount: number;
  sellerCount: number;
  retentionRate: number;
  userGrowth: Array<{
    date: string;
    total: number;
    new: number;
    active: number;
  }>;
}

interface TransactionMetrics {
  totalTransactions: number;
  successRate: number;
  averageOrderValue: number;
  paymentMethods: Record<string, number>;
  transactionsByDay: Array<{
    date: string;
    count: number;
    volume: number;
  }>;
  topCategories: Array<{
    category: string;
    transactions: number;
    volume: number;
  }>;
}

interface EngagementMetrics {
  views: number;
  searches: number;
  favorites: number;
  messages: number;
  averageSessionDuration: number;
  searchToListingView: number;
  listingViewToContact: number;
  contactToTransaction: number;
  userPathAnalysis: Array<{
    path: string[];
    count: number;
    conversionRate: number;
  }>;
}

interface TimeRange {
  start: Date;
  end: Date;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private market = writable<MarketMetrics | null>(null);
  private users = writable<UserMetrics | null>(null);
  private transactions = writable<TransactionMetrics | null>(null);
  private engagement = writable<EngagementMetrics | null>(null);
  private updateInterval: NodeJS.Timer | null = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async init() {
    await this.refreshMetrics();
    this.startPeriodicUpdates();
  }

  private startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      this.refreshMetrics();
    }, 300000); // Every 5 minutes
  }

  private async refreshMetrics() {
    const timeRanges = {
      day: this.getTimeRange('day'),
      week: this.getTimeRange('week'),
      month: this.getTimeRange('month')
    };

    await Promise.all([
      this.updateMarketMetrics(timeRanges.day),
      this.updateUserMetrics(timeRanges.week),
      this.updateTransactionMetrics(timeRanges.day),
      this.updateEngagementMetrics(timeRanges.day)
    ]);
  }

  private getTimeRange(period: 'day' | 'week' | 'month'): TimeRange {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return { start, end };
  }

  private async updateMarketMetrics(timeRange: TimeRange) {
    try {
      // Get listings data
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .gte('created_at', timeRange.start.toISOString());

      if (listingsError) throw listingsError;

      // Get sales data
      const { data: sales, error: salesError } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'completed')
        .gte('created_at', timeRange.start.toISOString());

      if (salesError) throw salesError;

      // Calculate metrics
      const totalListings = listings.length;
      const activeListings = listings.filter(l => l.status === 'active').length;
      const totalSales = sales.length;
      const totalVolume = sales.reduce((sum, sale) => sum + sale.amount, 0);

      // Calculate category distribution
      const categoryDistribution: Record<string, number> = {};
      listings.forEach(listing => {
        categoryDistribution[listing.category] = (categoryDistribution[listing.category] || 0) + 1;
      });

      // Calculate price distribution
      const priceRanges = [
        { min: 0, max: 50, label: '$0-50' },
        { min: 51, max: 100, label: '$51-100' },
        { min: 101, max: 500, label: '$101-500' },
        { min: 501, max: 1000, label: '$501-1000' },
        { min: 1001, max: Infinity, label: '$1000+' }
      ];

      const priceDistribution = priceRanges.map(range => {
        const rangeListings = listings.filter(l => 
          l.price >= range.min && l.price <= range.max
        );
        return {
          range: range.label,
          count: rangeListings.length,
          volume: rangeListings.reduce((sum, l) => sum + l.price, 0)
        };
      });

      this.market.set({
        totalListings,
        activeListings,
        totalSales,
        totalVolume,
        averagePrice: totalVolume / totalSales || 0,
        conversionRate: totalSales / totalListings || 0,
        categoryDistribution,
        priceDistribution
      });
    } catch (error) {
      console.error('Error updating market metrics:', error);
    }
  }

  private async updateUserMetrics(timeRange: TimeRange) {
    try {
      // Get user data
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) throw usersError;

      const now = new Date();
      const activeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Calculate metrics
      const totalUsers = users.length;
      const activeUsers = users.filter(u => new Date(u.last_active) > activeThreshold).length;
      const newUsers = users.filter(u => new Date(u.created_at) > timeRange.start).length;

      // Calculate buyer/seller counts
      const { data: transactions } = await supabase
        .from('transactions')
        .select('buyer_id, seller_id')
        .gte('created_at', timeRange.start.toISOString());

      const buyerIds = new Set(transactions?.map(t => t.buyer_id) || []);
      const sellerIds = new Set(transactions?.map(t => t.seller_id) || []);

      // Calculate user growth trend
      const growth = new Map<string, { total: number; new: number; active: number }>();
      const days = (timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 60 * 60 * 1000);

      for (let i = 0; i <= days; i++) {
        const date = new Date(timeRange.start);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        growth.set(dateStr, {
          total: users.filter(u => new Date(u.created_at) <= date).length,
          new: users.filter(u => new Date(u.created_at).toISOString().startsWith(dateStr)).length,
          active: users.filter(u => new Date(u.last_active).toISOString().startsWith(dateStr)).length
        });
      }

      this.users.set({
        totalUsers,
        activeUsers,
        newUsers,
        buyerCount: buyerIds.size,
        sellerCount: sellerIds.size,
        retentionRate: activeUsers / totalUsers,
        userGrowth: Array.from(growth.entries()).map(([date, data]) => ({
          date,
          ...data
        }))
      });
    } catch (error) {
      console.error('Error updating user metrics:', error);
    }
  }

  private async updateTransactionMetrics(timeRange: TimeRange) {
    try {
      // Get transaction data
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', timeRange.start.toISOString());

      if (transactionsError) throw transactionsError;

      // Calculate basic metrics
      const totalTransactions = transactions.length;
      const successfulTransactions = transactions.filter(t => t.status === 'completed');
      const successRate = successfulTransactions.length / totalTransactions;
      const totalVolume = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);
      const averageOrderValue = totalVolume / successfulTransactions.length;

      // Calculate payment method distribution
      const paymentMethods: Record<string, number> = {};
      transactions.forEach(t => {
        paymentMethods[t.payment_method] = (paymentMethods[t.payment_method] || 0) + 1;
      });

      // Calculate daily transactions
      const transactionsByDay = new Map<string, { count: number; volume: number }>();
      transactions.forEach(t => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        const current = transactionsByDay.get(date) || { count: 0, volume: 0 };
        transactionsByDay.set(date, {
          count: current.count + 1,
          volume: current.volume + t.amount
        });
      });

      // Calculate top categories
      const categoryTransactions = new Map<string, { transactions: number; volume: number }>();
      transactions.forEach(t => {
        const current = categoryTransactions.get(t.category) || { transactions: 0, volume: 0 };
        categoryTransactions.set(t.category, {
          transactions: current.transactions + 1,
          volume: current.volume + t.amount
        });
      });

      const topCategories = Array.from(categoryTransactions.entries())
        .map(([category, data]) => ({
          category,
          ...data
        }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);

      this.transactions.set({
        totalTransactions,
        successRate,
        averageOrderValue,
        paymentMethods,
        transactionsByDay: Array.from(transactionsByDay.entries()).map(([date, data]) => ({
          date,
          ...data
        })),
        topCategories
      });
    } catch (error) {
      console.error('Error updating transaction metrics:', error);
    }
  }

  private async updateEngagementMetrics(timeRange: TimeRange) {
    try {
      // Get event data
      const { data: events, error: eventsError } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', timeRange.start.toISOString());

      if (eventsError) throw eventsError;

      // Calculate basic metrics
      const views = events.filter(e => e.type === 'view').length;
      const searches = events.filter(e => e.type === 'search').length;
      const favorites = events.filter(e => e.type === 'favorite').length;
      const messages = events.filter(e => e.type === 'message').length;

      // Calculate conversion rates
      const searchEvents = events.filter(e => e.type === 'search');
      const listingViewEvents = events.filter(e => e.type === 'view');
      const contactEvents = events.filter(e => e.type === 'contact');
      const transactionEvents = events.filter(e => e.type === 'transaction');

      const searchToListingView = listingViewEvents.length / searchEvents.length;
      const listingViewToContact = contactEvents.length / listingViewEvents.length;
      const contactToTransaction = transactionEvents.length / contactEvents.length;

      // Analyze user paths
      const userPaths = new Map<string, { count: number; conversions: number }>();
      const sessions = this.groupEventsBySession(events);

      sessions.forEach(session => {
        const path = session.map(e => e.type);
        const pathKey = path.join(' > ');
        const current = userPaths.get(pathKey) || { count: 0, conversions: 0 };
        
        userPaths.set(pathKey, {
          count: current.count + 1,
          conversions: current.conversions + (path.includes('transaction') ? 1 : 0)
        });
      });

      const userPathAnalysis = Array.from(userPaths.entries())
        .map(([path, data]) => ({
          path: path.split(' > '),
          count: data.count,
          conversionRate: data.conversions / data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      this.engagement.set({
        views,
        searches,
        favorites,
        messages,
        averageSessionDuration: this.calculateAverageSessionDuration(sessions),
        searchToListingView,
        listingViewToContact,
        contactToTransaction,
        userPathAnalysis
      });
    } catch (error) {
      console.error('Error updating engagement metrics:', error);
    }
  }

  private groupEventsBySession(events: any[]): any[][] {
    const sessions: any[][] = [];
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    let currentSession: any[] = [];
    let lastEventTime = 0;

    events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(event => {
        const eventTime = new Date(event.created_at).getTime();

        if (eventTime - lastEventTime > sessionTimeout) {
          if (currentSession.length > 0) {
            sessions.push(currentSession);
          }
          currentSession = [];
        }

        currentSession.push(event);
        lastEventTime = eventTime;
      });

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  private calculateAverageSessionDuration(sessions: any[][]): number {
    const durations = sessions.map(session => {
      const start = new Date(session[0].created_at).getTime();
      const end = new Date(session[session.length - 1].created_at).getTime();
      return end - start;
    });

    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  // Public methods
  getMarketMetrics() {
    return this.market;
  }

  getUserMetrics() {
    return this.users;
  }

  getTransactionMetrics() {
    return this.transactions;
  }

  getEngagementMetrics() {
    return this.engagement;
  }

  async trackEvent(event: {
    type: string;
    userId: string;
    targetId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert([{
          type: event.type,
          user_id: event.userId,
          target_id: event.targetId,
          metadata: event.metadata,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance(); 