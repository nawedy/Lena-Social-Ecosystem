import { EventEmitter } from 'events';
import { supabase } from '../../supabase';

interface JobBoard {
  id: string;
  name: string;
  type: 'api' | 'scraper';
  config: {
    apiKey?: string;
    baseUrl?: string;
    scrapingRules?: {
      listingSelector: string;
      titleSelector: string;
      companySelector: string;
      locationSelector: string;
      descriptionSelector: string;
      salarySelector?: string;
      requirementsSelector?: string;
    };
  };
  status: 'active' | 'inactive' | 'error';
  lastSync?: string;
  error?: string;
}

interface ExternalJob {
  id: string;
  boardId: string;
  externalId: string;
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  requirements?: string[];
  type: string;
  category: string;
  postedAt: string;
  expiresAt?: string;
  raw: Record<string, any>;
}

interface SyncStats {
  jobBoard: string;
  startTime: string;
  endTime: string;
  totalJobs: number;
  newJobs: number;
  updatedJobs: number;
  errors: Array<{
    message: string;
    context: Record<string, any>;
  }>;
}

export class JobBoardService extends EventEmitter {
  private static instance: JobBoardService;
  private jobBoards: Map<string, JobBoard> = new Map();
  private syncInterval: NodeJS.Timer | null = null;
  private isSyncing = false;

  private constructor() {
    super();
    this.setupJobBoards();
    this.startPeriodicSync();
  }

  static getInstance(): JobBoardService {
    if (!JobBoardService.instance) {
      JobBoardService.instance = new JobBoardService();
    }
    return JobBoardService.instance;
  }

  private async setupJobBoards() {
    const { data, error } = await supabase
      .from('job_boards')
      .select('*');

    if (error) throw error;

    for (const board of data) {
      this.jobBoards.set(board.id, this.transformJobBoard(board));
    }
  }

  private startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      this.syncAllBoards();
    }, 3600000); // Every hour
  }

  async addJobBoard(board: Omit<JobBoard, 'id' | 'status' | 'lastSync'>): Promise<JobBoard> {
    const { data, error } = await supabase
      .from('job_boards')
      .insert([{
        ...board,
        status: 'active',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const jobBoard = this.transformJobBoard(data);
    this.jobBoards.set(jobBoard.id, jobBoard);
    return jobBoard;
  }

  async updateJobBoard(id: string, updates: Partial<JobBoard>): Promise<JobBoard> {
    const { data, error } = await supabase
      .from('job_boards')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const jobBoard = this.transformJobBoard(data);
    this.jobBoards.set(jobBoard.id, jobBoard);
    return jobBoard;
  }

  async syncAllBoards(): Promise<SyncStats[]> {
    if (this.isSyncing) return [];
    this.isSyncing = true;

    try {
      const activeBoards = Array.from(this.jobBoards.values())
        .filter(board => board.status === 'active');

      const stats = await Promise.all(
        activeBoards.map(board => this.syncBoard(board))
      );

      return stats;
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncBoard(board: JobBoard): Promise<SyncStats> {
    const stats: SyncStats = {
      jobBoard: board.name,
      startTime: new Date().toISOString(),
      endTime: '',
      totalJobs: 0,
      newJobs: 0,
      updatedJobs: 0,
      errors: []
    };

    try {
      const jobs = board.type === 'api'
        ? await this.fetchJobsFromApi(board)
        : await this.scrapeJobs(board);

      stats.totalJobs = jobs.length;

      for (const job of jobs) {
        try {
          await this.processJob(job);
          const isNew = !(await this.jobExists(job.externalId));
          isNew ? stats.newJobs++ : stats.updatedJobs++;
        } catch (error) {
          stats.errors.push({
            message: error.message,
            context: { jobId: job.externalId }
          });
        }
      }

      await this.updateJobBoard(board.id, {
        lastSync: new Date().toISOString(),
        error: undefined
      });
    } catch (error) {
      await this.updateJobBoard(board.id, {
        status: 'error',
        error: error.message
      });

      stats.errors.push({
        message: error.message,
        context: { boardId: board.id }
      });
    }

    stats.endTime = new Date().toISOString();
    this.emit('sync:complete', stats);
    return stats;
  }

  private async fetchJobsFromApi(board: JobBoard): Promise<ExternalJob[]> {
    if (!board.config.apiKey || !board.config.baseUrl) {
      throw new Error('Missing API configuration');
    }

    const response = await fetch(`${board.config.baseUrl}/jobs`, {
      headers: {
        'Authorization': `Bearer ${board.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeJobs(data, board);
  }

  private async scrapeJobs(board: JobBoard): Promise<ExternalJob[]> {
    if (!board.config.scrapingRules) {
      throw new Error('Missing scraping configuration');
    }

    // TODO: Implement web scraping using Puppeteer or similar
    return [];
  }

  private async processJob(job: ExternalJob): Promise<void> {
    const { error } = await supabase
      .from('external_jobs')
      .upsert({
        external_id: job.externalId,
        board_id: job.boardId,
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        salary: job.salary,
        requirements: job.requirements,
        type: job.type,
        category: job.category,
        posted_at: job.postedAt,
        expires_at: job.expiresAt,
        raw_data: job.raw,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  private async jobExists(externalId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('external_jobs')
      .select('id')
      .eq('external_id', externalId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  private normalizeJobs(data: any[], board: JobBoard): ExternalJob[] {
    return data.map(item => ({
      id: crypto.randomUUID(),
      boardId: board.id,
      externalId: item.id,
      url: item.url,
      title: item.title,
      company: item.company,
      location: item.location,
      description: item.description,
      salary: item.salary && {
        min: parseFloat(item.salary.min),
        max: parseFloat(item.salary.max),
        currency: item.salary.currency
      },
      requirements: Array.isArray(item.requirements)
        ? item.requirements
        : typeof item.requirements === 'string'
          ? item.requirements.split('\n').filter(Boolean)
          : undefined,
      type: item.type,
      category: item.category,
      postedAt: item.posted_at || item.postedAt || new Date().toISOString(),
      expiresAt: item.expires_at || item.expiresAt,
      raw: item
    }));
  }

  private transformJobBoard(raw: any): JobBoard {
    return {
      id: raw.id,
      name: raw.name,
      type: raw.type,
      config: raw.config,
      status: raw.status,
      lastSync: raw.last_sync,
      error: raw.error
    };
  }

  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.jobBoards.clear();
  }
}

// Create job board service instance
export const jobBoardService = JobBoardService.getInstance(); 