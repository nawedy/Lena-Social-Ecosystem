import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { notificationService } from '../notification/NotificationService';

interface ReputationEvent {
  id: string;
  userId: string;
  type: 'post' | 'comment' | 'reaction' | 'accepted' | 'badge' | 'moderation';
  amount: number;
  reason: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface ReputationLevel {
  id: string;
  name: string;
  description: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
  icon: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  category: 'achievement' | 'contribution' | 'moderation' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
  icon: string;
  requirements: {
    type: string;
    threshold: number;
  }[];
  metadata?: Record<string, any>;
}

interface UserReputation {
  userId: string;
  points: number;
  level: ReputationLevel;
  badges: Badge[];
  history: ReputationEvent[];
  stats: {
    totalEarned: number;
    totalSpent: number;
    byType: Record<string, number>;
    byPeriod: Array<{
      period: string;
      earned: number;
      spent: number;
    }>;
  };
}

export class ReputationService {
  private static instance: ReputationService;
  private levels: Map<string, ReputationLevel> = new Map();
  private badges: Map<string, Badge> = new Map();
  private userReputation = writable<UserReputation | null>(null);
  private realtimeSubscription: any = null;

  private readonly REPUTATION_RULES = {
    post: {
      create: 5,
      upvote: 10,
      downvote: -2,
      accepted: 15
    },
    comment: {
      create: 2,
      upvote: 5,
      downvote: -1
    },
    moderation: {
      approve: 3,
      reject: -1,
      flag: -5
    }
  };

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): ReputationService {
    if (!ReputationService.instance) {
      ReputationService.instance = new ReputationService();
    }
    return ReputationService.instance;
  }

  private async init() {
    await Promise.all([
      this.loadLevels(),
      this.loadBadges(),
      this.loadUserReputation(),
      this.setupRealtimeSubscription()
    ]);
  }

  private async loadLevels() {
    try {
      const { data, error } = await supabase
        .from('reputation_levels')
        .select('*')
        .order('min_points', { ascending: true });

      if (error) throw error;

      this.levels.clear();
      for (const level of data) {
        this.levels.set(level.id, this.transformLevel(level));
      }
    } catch (error) {
      console.error('Error loading reputation levels:', error);
    }
  }

  private async loadBadges() {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('points', { ascending: true });

      if (error) throw error;

      this.badges.clear();
      for (const badge of data) {
        this.badges.set(badge.id, this.transformBadge(badge));
      }
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  }

  private async loadUserReputation() {
    try {
      const { data: userData, error: userError } = await supabase
        .from('user_reputation')
        .select(`
          user_id,
          points,
          level_id,
          badges (id),
          reputation_events (*)
        `)
        .single();

      if (userError && userError.code !== 'PGRST116') throw userError;

      if (userData) {
        const level = this.levels.get(userData.level_id);
        if (!level) throw new Error('Invalid reputation level');

        const badges = userData.badges
          .map((b: any) => this.badges.get(b.id))
          .filter(Boolean);

        const history = userData.reputation_events.map(this.transformEvent);

        const stats = this.calculateStats(history);

        this.userReputation.set({
          userId: userData.user_id,
          points: userData.points,
          level,
          badges,
          history,
          stats
        });
      }
    } catch (error) {
      console.error('Error loading user reputation:', error);
    }
  }

  private setupRealtimeSubscription() {
    this.realtimeSubscription = supabase
      .channel('reputation_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reputation_events'
      }, payload => {
        this.handleRealtimeUpdate(payload);
      })
      .subscribe();
  }

  private async handleRealtimeUpdate(payload: any) {
    // Update reputation store
    this.userReputation.update(reputation => {
      if (!reputation) return reputation;

      const event = this.transformEvent(payload.new);

      switch (payload.eventType) {
        case 'INSERT':
          reputation.history = [event, ...reputation.history];
          reputation.points += event.amount;
          break;
        case 'DELETE':
          reputation.history = reputation.history.filter(e => e.id !== event.id);
          reputation.points -= event.amount;
          break;
      }

      // Recalculate stats
      reputation.stats = this.calculateStats(reputation.history);

      // Check for level changes
      const newLevel = this.getLevelForPoints(reputation.points);
      if (newLevel.id !== reputation.level.id) {
        reputation.level = newLevel;
        this.notifyLevelChange(newLevel);
      }

      // Check for new badges
      const newBadges = this.checkForNewBadges(reputation);
      if (newBadges.length > 0) {
        reputation.badges = [...reputation.badges, ...newBadges];
        this.notifyNewBadges(newBadges);
      }

      return reputation;
    });
  }

  private calculateStats(history: ReputationEvent[]): UserReputation['stats'] {
    const stats = {
      totalEarned: 0,
      totalSpent: 0,
      byType: {} as Record<string, number>,
      byPeriod: [] as Array<{
        period: string;
        earned: number;
        spent: number;
      }>
    };

    // Calculate totals and type distribution
    history.forEach(event => {
      if (event.amount > 0) {
        stats.totalEarned += event.amount;
      } else {
        stats.totalSpent += Math.abs(event.amount);
      }

      stats.byType[event.type] = (stats.byType[event.type] || 0) + event.amount;
    });

    // Calculate period distribution (last 12 months)
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const period = new Date(now.getFullYear(), now.getMonth() - i, 1)
        .toISOString()
        .slice(0, 7);

      const periodEvents = history.filter(event =>
        event.createdAt.startsWith(period)
      );

      stats.byPeriod.push({
        period,
        earned: periodEvents.reduce((sum, event) =>
          sum + (event.amount > 0 ? event.amount : 0), 0
        ),
        spent: periodEvents.reduce((sum, event) =>
          sum + (event.amount < 0 ? Math.abs(event.amount) : 0), 0
        )
      });
    }

    return stats;
  }

  private getLevelForPoints(points: number): ReputationLevel {
    return Array.from(this.levels.values())
      .find(level => points >= level.minPoints && points <= level.maxPoints) ||
      Array.from(this.levels.values())[0];
  }

  private checkForNewBadges(reputation: UserReputation): Badge[] {
    const newBadges: Badge[] = [];
    const existingBadgeIds = new Set(reputation.badges.map(b => b.id));

    for (const badge of this.badges.values()) {
      if (existingBadgeIds.has(badge.id)) continue;

      const meetsRequirements = badge.requirements.every(req => {
        switch (req.type) {
          case 'points':
            return reputation.points >= req.threshold;
          case 'posts':
            return reputation.stats.byType['post'] >= req.threshold;
          case 'comments':
            return reputation.stats.byType['comment'] >= req.threshold;
          case 'reactions':
            return reputation.stats.byType['reaction'] >= req.threshold;
          default:
            return false;
        }
      });

      if (meetsRequirements) {
        newBadges.push(badge);
      }
    }

    return newBadges;
  }

  private async notifyLevelChange(newLevel: ReputationLevel) {
    await notificationService.createNotification({
      userId: 'current-user-id', // Replace with actual user ID
      type: 'achievement',
      title: 'New Reputation Level!',
      body: `Congratulations! You've reached the ${newLevel.name} level. ${newLevel.description}`,
      icon: newLevel.icon,
      metadata: {
        type: 'level',
        levelId: newLevel.id
      }
    });
  }

  private async notifyNewBadges(badges: Badge[]) {
    for (const badge of badges) {
      await notificationService.createNotification({
        userId: 'current-user-id', // Replace with actual user ID
        type: 'achievement',
        title: 'New Badge Earned!',
        body: `You've earned the ${badge.name} badge! ${badge.description}`,
        icon: badge.icon,
        metadata: {
          type: 'badge',
          badgeId: badge.id
        }
      });
    }
  }

  private transformLevel(raw: any): ReputationLevel {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      minPoints: raw.min_points,
      maxPoints: raw.max_points,
      benefits: raw.benefits,
      icon: raw.icon
    };
  }

  private transformBadge(raw: any): Badge {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      category: raw.category,
      tier: raw.tier,
      points: raw.points,
      icon: raw.icon,
      requirements: raw.requirements,
      metadata: raw.metadata
    };
  }

  private transformEvent(raw: any): ReputationEvent {
    return {
      id: raw.id,
      userId: raw.user_id,
      type: raw.type,
      amount: raw.amount,
      reason: raw.reason,
      metadata: raw.metadata,
      createdAt: raw.created_at
    };
  }

  // Public methods
  async awardPoints(event: Omit<ReputationEvent, 'id' | 'createdAt'>): Promise<ReputationEvent> {
    const { data, error } = await supabase
      .from('reputation_events')
      .insert([{
        ...event,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return this.transformEvent(data);
  }

  async awardBadge(badgeId: string): Promise<void> {
    const badge = this.badges.get(badgeId);
    if (!badge) throw new Error('Invalid badge ID');

    const { error } = await supabase
      .from('user_badges')
      .insert([{
        user_id: 'current-user-id', // Replace with actual user ID
        badge_id: badgeId,
        awarded_at: new Date().toISOString()
      }]);

    if (error) throw error;

    // Award points for the badge
    await this.awardPoints({
      userId: 'current-user-id', // Replace with actual user ID
      type: 'badge',
      amount: badge.points,
      reason: `Earned the ${badge.name} badge`,
      metadata: {
        badgeId: badge.id
      }
    });
  }

  getReputationRules() {
    return this.REPUTATION_RULES;
  }

  getUserReputation() {
    return this.userReputation;
  }

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }
}

// Create service instance
export const reputationService = ReputationService.getInstance(); 