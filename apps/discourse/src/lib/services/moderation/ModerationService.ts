import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { performanceOptimizationService } from '../optimization/PerformanceOptimizationService';

interface ModerationRule {
  id: string;
  type: 'keyword' | 'pattern' | 'toxicity' | 'spam' | 'custom';
  name: string;
  description: string;
  pattern: string | RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'flag' | 'hide' | 'delete' | 'ban';
  automate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModerationAction {
  id: string;
  type: 'warning' | 'mute' | 'ban' | 'delete';
  targetType: 'user' | 'content' | 'discussion';
  targetId: string;
  reason: string;
  evidence: string[];
  moderatorId: string;
  duration?: number;
  createdAt: string;
  expiresAt?: string;
}

interface Report {
  id: string;
  type: 'spam' | 'harassment' | 'hate' | 'misinformation' | 'other';
  targetType: 'user' | 'content' | 'discussion';
  targetId: string;
  reporterId: string;
  reason: string;
  evidence: string[];
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  resolution?: {
    action: ModerationAction['type'];
    note: string;
    moderatorId: string;
    timestamp: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ModeratorActivity {
  id: string;
  moderatorId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  averageResolutionTime: number;
  actionsByType: Record<string, number>;
  reportsByType: Record<string, number>;
  moderatorPerformance: Array<{
    moderatorId: string;
    actionsCount: number;
    averageResponseTime: number;
    resolutionRate: number;
  }>;
}

export class ModerationService {
  private static instance: ModerationService;
  private rules: Map<string, ModerationRule> = new Map();
  private actions: Map<string, ModerationAction> = new Map();
  private reports = writable<Report[]>([]);
  private stats = writable<ModerationStats | null>(null);
  private realtimeSubscription: any = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): ModerationService {
    if (!ModerationService.instance) {
      ModerationService.instance = new ModerationService();
    }
    return ModerationService.instance;
  }

  private async init() {
    await Promise.all([
      this.loadRules(),
      this.loadReports(),
      this.calculateStats()
    ]);
    this.setupRealtimeSubscription();
  }

  private async loadRules() {
    try {
      const { data, error } = await supabase
        .from('moderation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.rules.clear();
      for (const rule of data) {
        if (rule.pattern && typeof rule.pattern === 'string' && rule.type === 'pattern') {
          rule.pattern = new RegExp(rule.pattern, 'i');
        }
        this.rules.set(rule.id, rule);
      }
    } catch (error) {
      console.error('Error loading moderation rules:', error);
    }
  }

  private async loadReports() {
    try {
      const { data, error } = await supabase
        .from('moderation_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.reports.set(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }

  private setupRealtimeSubscription() {
    this.realtimeSubscription = supabase
      .channel('moderation_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'moderation_reports' 
      }, payload => {
        this.handleRealtimeUpdate(payload);
      })
      .subscribe();
  }

  private async handleRealtimeUpdate(payload: any) {
    // Update reports store
    this.reports.update(reports => {
      switch (payload.eventType) {
        case 'INSERT':
          return [...reports, payload.new];
        case 'UPDATE':
          return reports.map(report => 
            report.id === payload.new.id ? payload.new : report
          );
        case 'DELETE':
          return reports.filter(report => report.id !== payload.old.id);
        default:
          return reports;
      }
    });

    // Recalculate stats
    await this.calculateStats();
  }

  private async calculateStats() {
    let reports: Report[] = [];
    this.reports.subscribe(value => {
      reports = value;
    })();

    const now = new Date().getTime();
    const stats: ModerationStats = {
      totalReports: reports.length,
      pendingReports: reports.filter(r => r.status === 'pending').length,
      resolvedReports: reports.filter(r => r.status === 'resolved').length,
      averageResolutionTime: 0,
      actionsByType: {},
      reportsByType: {},
      moderatorPerformance: []
    };

    // Calculate average resolution time
    const resolutionTimes = reports
      .filter(r => r.resolution)
      .map(r => new Date(r.resolution!.timestamp).getTime() - new Date(r.createdAt).getTime());
    
    if (resolutionTimes.length > 0) {
      stats.averageResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
    }

    // Count reports by type
    reports.forEach(report => {
      stats.reportsByType[report.type] = (stats.reportsByType[report.type] || 0) + 1;
    });

    // Count actions by type
    Array.from(this.actions.values()).forEach(action => {
      stats.actionsByType[action.type] = (stats.actionsByType[action.type] || 0) + 1;
    });

    // Calculate moderator performance
    const moderatorActions = new Map<string, {
      actions: number;
      responseTimes: number[];
      resolutions: number;
      totalReports: number;
    }>();

    reports.forEach(report => {
      if (report.assignedTo) {
        const moderator = moderatorActions.get(report.assignedTo) || {
          actions: 0,
          responseTimes: [],
          resolutions: 0,
          totalReports: 0
        };

        moderator.totalReports++;

        if (report.resolution) {
          moderator.resolutions++;
          moderator.responseTimes.push(
            new Date(report.resolution.timestamp).getTime() - new Date(report.createdAt).getTime()
          );
        }

        moderatorActions.set(report.assignedTo, moderator);
      }
    });

    stats.moderatorPerformance = Array.from(moderatorActions.entries()).map(([moderatorId, data]) => ({
      moderatorId,
      actionsCount: data.actions,
      averageResponseTime: data.responseTimes.length > 0
        ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
        : 0,
      resolutionRate: data.totalReports > 0
        ? data.resolutions / data.totalReports
        : 0
    }));

    this.stats.set(stats);
  }

  // Public methods
  async moderateContent(content: string, context: {
    type: 'discussion' | 'comment' | 'user';
    userId: string;
  }): Promise<{
    approved: boolean;
    flags: Array<{
      rule: ModerationRule;
      matches: string[];
    }>;
  }> {
    const flags: Array<{
      rule: ModerationRule;
      matches: string[];
    }> = [];

    // Check against each rule
    for (const rule of this.rules.values()) {
      if (!rule.automate) continue;

      let matches: string[] = [];
      switch (rule.type) {
        case 'keyword':
          {
            const keywords = (rule.pattern as string).split(',').map(k => k.trim().toLowerCase());
            const contentWords = content.toLowerCase().split(/\s+/);
            matches = keywords.filter(k => contentWords.includes(k));
          }
          break;

        case 'pattern':
          {
            const pattern = rule.pattern as RegExp;
            const match = content.match(pattern);
            if (match) {
              matches = match;
            }
          }
          break;

        case 'toxicity':
          // Implement toxicity detection using AI/ML
          break;

        case 'spam':
          // Implement spam detection
          break;
      }

      if (matches.length > 0) {
        flags.push({ rule, matches });
      }
    }

    // Determine if content should be approved
    const approved = !flags.some(flag => 
      flag.rule.severity === 'critical' || 
      flag.rule.action === 'delete' || 
      flag.rule.action === 'ban'
    );

    return { approved, flags };
  }

  async submitReport(report: Omit<Report, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Report> {
    const { data, error } = await supabase
      .from('moderation_reports')
      .insert([{
        ...report,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateReport(reportId: string, updates: Partial<Report>): Promise<Report> {
    const { data, error } = await supabase
      .from('moderation_reports')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async takeAction(action: Omit<ModerationAction, 'id' | 'createdAt'>): Promise<ModerationAction> {
    const { data, error } = await supabase
      .from('moderation_actions')
      .insert([{
        ...action,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const moderationAction = data;
    this.actions.set(moderationAction.id, moderationAction);
    return moderationAction;
  }

  async addRule(rule: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModerationRule> {
    const { data, error } = await supabase
      .from('moderation_rules')
      .insert([{
        ...rule,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const moderationRule = data;
    this.rules.set(moderationRule.id, moderationRule);
    return moderationRule;
  }

  getReports() {
    return this.reports;
  }

  getStats() {
    return this.stats;
  }

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
    this.rules.clear();
    this.actions.clear();
  }
}

// Create service instance
export const moderationService = ModerationService.getInstance(); 