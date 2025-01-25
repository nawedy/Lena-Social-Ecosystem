import { BskyAgent } from '@atproto/api';

export interface ContentTemplate {
  uri: string;
  cid: string;
  name: string;
  type: 'post' | 'product' | 'promotion' | 'email' | 'notification';
  template: string;
  variables: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'image' | 'url' | 'boolean';
    required: boolean;
    defaultValue?: string;
  }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSchedule {
  uri: string;
  cid: string;
  name: string;
  templateUri: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  schedule: {
    startDate: string;
    endDate?: string;
    time?: string;
    daysOfWeek?: number[];
    daysOfMonth?: number[];
  };
  variables: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed' | 'error';
  lastRun?: string;
  nextRun?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentAnalytics {
  templateUri: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    impressions: number;
    engagements: number;
    clicks?: number;
    conversions?: number;
  };
  performance: {
    score: number;
    trends: Array<{
      metric: string;
      change: number;
      insight: string;
    }>;
  };
}

export interface ContentOptimization {
  templateUri: string;
  recommendations: Array<{
    type: 'timing' | 'content' | 'targeting' | 'format';
    priority: 'low' | 'medium' | 'high';
    suggestion: string;
    expectedImpact: number;
    confidence: number;
  }>;
  abTests: Array<{
    id: string;
    variant: string;
    performance: number;
    sampleSize: number;
    confidence: number;
  }>;
}

export class ATProtocolContentAutomation {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Template Management
  public async createTemplate(
    params: Omit<ContentTemplate, 'uri' | 'cid' | 'createdAt' | 'updatedAt'>
  ): Promise<ContentTemplate> {
    const record = {
      $type: 'app.bsky.commerce.contentTemplate',
      ...params,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.contentTemplate',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  public async updateTemplate(params: {
    uri: string;
    updates: Partial<
      Omit<ContentTemplate, 'uri' | 'cid' | 'createdAt' | 'updatedAt'>
    >;
  }): Promise<ContentTemplate> {
    const current = await this.getTemplate(params.uri);
    if (!current) throw new Error('Template not found');

    const record = {
      $type: 'app.bsky.commerce.contentTemplate',
      ...current,
      ...params.updates,
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.contentTemplate',
      rkey: params.uri.split('/').pop() ?? '',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  // Schedule Management
  public async createSchedule(
    params: Omit<ContentSchedule, 'uri' | 'cid'>
  ): Promise<ContentSchedule> {
    // Validate template exists
    const template = await this.getTemplate(params.templateUri);
    if (!template) throw new Error('Template not found');

    // Validate variables match template requirements
    this.validateTemplateVariables(template, params.variables);

    const record = {
      $type: 'app.bsky.commerce.contentSchedule',
      ...params,
      nextRun: this.calculateNextRun(params.schedule, params.frequency),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.contentSchedule',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  public async updateScheduleStatus(params: {
    uri: string;
    status: ContentSchedule['status'];
  }): Promise<ContentSchedule> {
    const current = await this.getSchedule(params.uri);
    if (!current) throw new Error('Schedule not found');

    const record = {
      ...current,
      status: params.status,
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.contentSchedule',
      rkey: params.uri.split('/').pop() ?? '',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
    };
  }

  // Content Generation
  public async generateContent(params: {
    templateUri: string;
    variables: Record<string, unknown>;
    optimize?: boolean;
  }): Promise<{
    content: string;
    metadata: Record<string, unknown>;
  }> {
    const template = await this.getTemplate(params.templateUri);
    if (!template) throw new Error('Template not found');

    // Validate variables
    this.validateTemplateVariables(template, params.variables);

    // Generate content using template and variables
    let content = template.template;
    for (const [key, value] of Object.entries(params.variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Optimize content if requested
    if (params.optimize) {
      const optimization = await this.getContentOptimization(
        params.templateUri
      );
      content = await this.applyOptimizations(content, optimization);
    }

    return {
      content,
      metadata: {
        templateUri: params.templateUri,
        generatedAt: new Date().toISOString(),
        variables: params.variables,
      },
    };
  }

  // Analytics
  public async getContentAnalytics(params: {
    templateUri: string;
    period: {
      start: string;
      end: string;
    };
  }): Promise<ContentAnalytics> {
    const response = await this.agent.api.app.bsky.commerce.getContentAnalytics(
      {
        templateUri: params.templateUri,
        period: params.period,
      }
    );

    return response.data;
  }

  // Optimization
  public async getContentOptimization(
    templateUri: string
  ): Promise<ContentOptimization> {
    const response =
      await this.agent.api.app.bsky.commerce.getContentOptimization({
        templateUri,
      });

    return response.data;
  }

  // A/B Testing
  public async createABTest(params: {
    templateUri: string;
    variants: Array<{
      name: string;
      content: string;
    }>;
    duration: number; // days
    targetAudience?: string[];
  }): Promise<{
    testId: string;
    variants: Array<{
      id: string;
      name: string;
      content: string;
    }>;
    startDate: string;
    endDate: string;
  }> {
    const response = await this.agent.api.app.bsky.commerce.createABTest({
      templateUri: params.templateUri,
      variants: params.variants,
      duration: params.duration,
      targetAudience: params.targetAudience,
    });

    return response.data;
  }

  // Private Helper Methods
  private async getTemplate(uri: string): Promise<ContentTemplate | null> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.contentTemplate',
        rkey: uri.split('/').pop() ?? '',
      });

      return response.data.value as ContentTemplate;
    } catch {
      return null;
    }
  }

  private async getSchedule(uri: string): Promise<ContentSchedule | null> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.commerce.contentSchedule',
        rkey: uri.split('/').pop() ?? '',
      });

      return response.data.value as ContentSchedule;
    } catch {
      return null;
    }
  }

  private validateTemplateVariables(
    template: ContentTemplate,
    variables: Record<string, unknown>
  ): void {
    const missingRequired = template.variables
      .filter(v => v.required)
      .filter(v => !(v.name in variables));

    if (missingRequired.length > 0) {
      throw new Error(
        `Missing required variables: ${missingRequired.map(v => v.name).join(', ')}`
      );
    }

    // Type validation
    for (const variable of template.variables) {
      if (variable.name in variables) {
        const value = variables[variable.name];
        if (!this.validateVariableType(value, variable.type)) {
          throw new Error(
            `Invalid type for variable ${variable.name}. Expected ${variable.type}`
          );
        }
      }
    }
  }

  private validateVariableType(value: unknown, type: string): boolean {
    switch (type) {
      case 'text':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'date':
        return !isNaN(Date.parse(value));
      case 'image':
        return typeof value === 'string' && /^blob:/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true;
    }
  }

  private calculateNextRun(
    schedule: ContentSchedule['schedule'],
    frequency: ContentSchedule['frequency']
  ): string {
    const now = new Date();
    const start = new Date(schedule.startDate);

    if (start > now) return start.toISOString();

    switch (frequency) {
      case 'once':
        return schedule.startDate;

      case 'daily': {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(
          schedule.time ? parseInt(schedule.time.split(':')[0]) : 0,
          schedule.time ? parseInt(schedule.time.split(':')[1]) : 0,
          0,
          0
        );
        return tomorrow.toISOString();
      }

      case 'weekly': {
        if (!schedule.daysOfWeek?.length) return start.toISOString();
        const nextWeekday = this.getNextWeekday(now, schedule.daysOfWeek);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          nextWeekday.setHours(hours, minutes, 0, 0);
        }
        return nextWeekday.toISOString();
      }

      case 'monthly': {
        if (!schedule.daysOfMonth?.length) return start.toISOString();
        const nextMonthDay = this.getNextMonthDay(now, schedule.daysOfMonth);
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          nextMonthDay.setHours(hours, minutes, 0, 0);
        }
        return nextMonthDay.toISOString();
      }

      default:
        return start.toISOString();
    }
  }

  private getNextWeekday(from: Date, daysOfWeek: number[]): Date {
    const sorted = [...daysOfWeek].sort((a, b) => a - b);
    const today = from.getDay();

    // Find next day in the current week
    const nextDay = sorted.find(day => day > today);
    const daysToAdd =
      nextDay !== undefined ? nextDay - today : 7 - today + sorted[0];

    const result = new Date(from);
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  private getNextMonthDay(from: Date, daysOfMonth: number[]): Date {
    const sorted = [...daysOfMonth].sort((a, b) => a - b);
    const today = from.getDate();

    // Find next day in the current month
    const nextDay = sorted.find(day => day > today);
    if (nextDay !== undefined) {
      const result = new Date(from);
      result.setDate(nextDay);
      return result;
    }

    // Move to first available day of next month
    const result = new Date(from);
    result.setMonth(result.getMonth() + 1);
    result.setDate(sorted[0]);
    return result;
  }

  private async applyOptimizations(
    content: string,
    optimization: ContentOptimization
  ): Promise<string> {
    let optimizedContent = content;

    // Apply high-priority recommendations first
    const highPriorityRecs = optimization.recommendations.filter(
      rec => rec.priority === 'high' && rec.type === 'content'
    );

    for (const rec of highPriorityRecs) {
      // Apply content optimization based on suggestion
      // This is a simplified example - in practice, you'd want more sophisticated
      // natural language processing and content transformation logic
      switch (rec.type) {
        case 'content':
          // Apply content-specific optimizations
          optimizedContent =
            await this.optimizeContentStructure(optimizedContent);
          break;
      }
    }

    return optimizedContent;
  }

  private async optimizeContentStructure(content: string): Promise<string> {
    // This is where you'd implement content optimization logic
    // For example:
    // - Improve readability
    // - Add hashtags
    // - Optimize for engagement
    // - Format for platform-specific requirements

    // For now, we'll just return the original content
    return content;
  }
}
