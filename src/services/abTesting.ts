import { BigQuery } from '@google-cloud/bigquery';
import { Datastore } from '@google-cloud/datastore';

import { config } from '../config';

import { completeAnalytics } from './completeAnalytics';
import { performanceMonitoring } from './performanceMonitoring';

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  variants: Array<{
    id: string;
    name: string;
    description: string;
    weight: number;
    config: Record<string, any>;
  }>;
  targetAudience: {
    filters: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
      value: any;
    }>;
    percentage: number;
  };
  metrics: Array<{
    name: string;
    type: 'conversion' | 'revenue' | 'engagement' | 'custom';
    goal: number;
    priority: 'primary' | 'secondary';
  }>;
  results?: {
    sampleSize: number;
    variants: Array<{
      id: string;
      metrics: Record<
        string,
        {
          value: number;
          confidence: number;
          improvement?: number;
        }
      >;
    }>;
    winner?: string;
    confidence: number;
  };
}

interface ExperimentAssignment {
  userId: string;
  experimentId: string;
  variantId: string;
  timestamp: string;
  converted: boolean;
  events: Array<{
    type: string;
    timestamp: string;
    data: Record<string, any>;
  }>;
}

export class ABTestingService {
  private static instance: ABTestingService;
  private datastore: Datastore;
  private bigquery: BigQuery;
  private experiments: Map<string, Experiment>;
  private assignments: Map<string, ExperimentAssignment>;
  private readonly ANALYSIS_INTERVAL = 3600000; // 1 hour
  private readonly CONFIDENCE_THRESHOLD = 0.95;

  private constructor() {
    this.datastore = new Datastore({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.bigquery = new BigQuery({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.experiments = new Map();
    this.assignments = new Map();

    this.initializeService();
  }

  public static getInstance(): ABTestingService {
    if (!ABTestingService.instance) {
      ABTestingService.instance = new ABTestingService();
    }
    return ABTestingService.instance;
  }

  private async initializeService(): Promise<void> {
    await this.loadExperiments();
    this.startPeriodicAnalysis();
  }

  // Experiment Management
  async createExperiment(
    params: Omit<Experiment, 'id' | 'status' | 'results'>
  ): Promise<Experiment> {
    const experiment: Experiment = {
      ...params,
      id: crypto.randomUUID(),
      status: 'draft',
    };

    await this.validateExperiment(experiment);
    await this.persistExperiment(experiment);
    this.experiments.set(experiment.id, experiment);

    return experiment;
  }

  async startExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    experiment.status = 'running';
    experiment.startDate = new Date().toISOString();
    await this.persistExperiment(experiment);

    // Track experiment start
    await completeAnalytics.trackEvent({
      type: 'experiment_started',
      data: {
        experimentId,
        name: experiment.name,
        variants: experiment.variants.map((v) => v.id),
      },
      metadata: {
        service: 'ab-testing',
        environment: config.app.env,
        version: '1.0.0',
      },
    });
  }

  async stopExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    experiment.status = 'completed';
    experiment.endDate = new Date().toISOString();
    await this.analyzeExperiment(experiment);
    await this.persistExperiment(experiment);

    // Track experiment completion
    await completeAnalytics.trackEvent({
      type: 'experiment_completed',
      data: {
        experimentId,
        results: experiment.results,
      },
      metadata: {
        service: 'ab-testing',
        environment: config.app.env,
        version: '1.0.0',
      },
    });
  }

  // Variant Assignment
  async assignVariant(params: {
    userId: string;
    experimentId: string;
  }): Promise<string> {
    const experiment = this.experiments.get(params.experimentId);
    if (!experiment || experiment.status !== 'running') {
      throw new Error('Experiment not running');
    }

    // Check if user is already assigned
    const existingAssignment = this.getAssignment(params.userId, params.experimentId);
    if (existingAssignment) {
      return existingAssignment.variantId;
    }

    // Check if user matches target audience
    if (!this.matchesTargetAudience(params.userId, experiment.targetAudience)) {
      throw new Error('User does not match target audience');
    }

    // Randomly assign variant based on weights
    const variantId = this.selectVariant(experiment.variants);
    const assignment: ExperimentAssignment = {
      userId: params.userId,
      experimentId: params.experimentId,
      variantId,
      timestamp: new Date().toISOString(),
      converted: false,
      events: [],
    };

    await this.persistAssignment(assignment);
    this.assignments.set(this.getAssignmentKey(params.userId, params.experimentId), assignment);

    // Track assignment
    await completeAnalytics.trackEvent({
      type: 'experiment_assignment',
      userId: params.userId,
      data: {
        experimentId: params.experimentId,
        variantId,
      },
      metadata: {
        service: 'ab-testing',
        environment: config.app.env,
        version: '1.0.0',
      },
    });

    return variantId;
  }

  // Event Tracking
  async trackEvent(params: {
    userId: string;
    experimentId: string;
    type: string;
    data: Record<string, any>;
  }): Promise<void> {
    const assignment = this.getAssignment(params.userId, params.experimentId);
    if (!assignment) {
      throw new Error('No experiment assignment found');
    }

    const event = {
      type: params.type,
      timestamp: new Date().toISOString(),
      data: params.data,
    };

    assignment.events.push(event);
    await this.persistAssignment(assignment);

    // Track event in analytics
    await completeAnalytics.trackEvent({
      type: 'experiment_event',
      userId: params.userId,
      data: {
        experimentId: params.experimentId,
        variantId: assignment.variantId,
        eventType: params.type,
        eventData: params.data,
      },
      metadata: {
        service: 'ab-testing',
        environment: config.app.env,
        version: '1.0.0',
      },
    });
  }

  async trackConversion(params: {
    userId: string;
    experimentId: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const assignment = this.getAssignment(params.userId, params.experimentId);
    if (!assignment) {
      throw new Error('No experiment assignment found');
    }

    assignment.converted = true;
    assignment.events.push({
      type: 'conversion',
      timestamp: new Date().toISOString(),
      data: params.data || {},
    });

    await this.persistAssignment(assignment);

    // Track conversion in analytics
    await completeAnalytics.trackEvent({
      type: 'experiment_conversion',
      userId: params.userId,
      data: {
        experimentId: params.experimentId,
        variantId: assignment.variantId,
        conversionData: params.data,
      },
      metadata: {
        service: 'ab-testing',
        environment: config.app.env,
        version: '1.0.0',
      },
    });
  }

  // Analysis
  async getExperimentResults(experimentId: string): Promise<Experiment['results']> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status === 'running') {
      await this.analyzeExperiment(experiment);
    }

    return experiment.results;
  }

  // Private Methods
  private async validateExperiment(experiment: Experiment): Promise<void> {
    // Validate variant weights sum to 1
    const weightSum = experiment.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(weightSum - 1) > 0.001) {
      throw new Error('Variant weights must sum to 1');
    }

    // Validate dates
    if (experiment.endDate && new Date(experiment.endDate) <= new Date(experiment.startDate)) {
      throw new Error('End date must be after start date');
    }

    // Validate metrics
    if (!experiment.metrics.some((m) => m.priority === 'primary')) {
      throw new Error('At least one primary metric is required');
    }
  }

  private async persistExperiment(experiment: Experiment): Promise<void> {
    const key = this.datastore.key(['Experiment', experiment.id]);
    await this.datastore.save({
      key,
      data: experiment,
    });
  }

  private async persistAssignment(assignment: ExperimentAssignment): Promise<void> {
    const key = this.datastore.key([
      'ExperimentAssignment',
      this.getAssignmentKey(assignment.userId, assignment.experimentId),
    ]);
    await this.datastore.save({
      key,
      data: assignment,
    });
  }

  private async loadExperiments(): Promise<void> {
    const query = this.datastore.createQuery('Experiment');
    const [experiments] = await this.datastore.runQuery(query);

    experiments.forEach((experiment: Experiment) => {
      this.experiments.set(experiment.id, experiment);
    });
  }

  private getAssignment(userId: string, experimentId: string): ExperimentAssignment | undefined {
    return this.assignments.get(this.getAssignmentKey(userId, experimentId));
  }

  private getAssignmentKey(userId: string, experimentId: string): string {
    return `${userId}:${experimentId}`;
  }

  private matchesTargetAudience(
    _userId: string,
    _targetAudience: Experiment['targetAudience']
  ): boolean {
    // Implementation would depend on user data structure and available attributes
    return true; // Placeholder
  }

  private selectVariant(variants: Experiment['variants']): string {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (random <= cumulativeWeight) {
        return variant.id;
      }
    }

    return variants[variants.length - 1].id;
  }

  private async analyzeExperiment(experiment: Experiment): Promise<void> {
    try {
      const query = `
        SELECT
          variantId,
          COUNT(DISTINCT userId) as users,
          COUNT(DISTINCT CASE WHEN converted THEN userId END) as conversions,
          AVG(CASE WHEN converted THEN 1 ELSE 0 END) as conversion_rate
        FROM \`${config.gcp.projectId}.analytics.experiment_assignments\`
        WHERE experimentId = @experimentId
        GROUP BY variantId
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { experimentId: experiment.id },
      });

      const controlVariant = rows[0];
      const results: Experiment['results'] = {
        sampleSize: rows.reduce((sum: number, row: any) => sum + row.users, 0),
        variants: rows.map((row: any) => ({
          id: row.variantId,
          metrics: {
            conversion_rate: {
              value: row.conversion_rate,
              confidence: this.calculateConfidence(row, controlVariant),
              improvement:
                row === controlVariant
                  ? 0
                  : ((row.conversion_rate - controlVariant.conversion_rate) /
                      controlVariant.conversion_rate) *
                    100,
            },
          },
        })),
        confidence: 0,
      };

      // Find winner if confidence threshold is met
      const significantVariants = results.variants.filter(
        (v) => v.metrics.conversion_rate.confidence > this.CONFIDENCE_THRESHOLD
      );

      if (significantVariants.length > 0) {
        results.winner = significantVariants.reduce((a, b) =>
          a.metrics.conversion_rate.value > b.metrics.conversion_rate.value ? a : b
        ).id;
        results.confidence = Math.max(
          ...significantVariants.map((v) => v.metrics.conversion_rate.confidence)
        );
      }

      experiment.results = results;
      await this.persistExperiment(experiment);
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'analyzeExperiment',
        experimentId: experiment.id,
      });
    }
  }

  private calculateConfidence(variant: any, control: any): number {
    // Implementation of statistical significance calculation
    // This is a simplified version - in practice, you'd want to use a proper statistical library
    const p1 = variant.conversion_rate;
    const p2 = control.conversion_rate;
    const n1 = variant.users;
    const n2 = control.users;

    const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
    const z = Math.abs(p1 - p2) / se;

    // Convert z-score to confidence level
    return 0.5 * (1 + Math.erf(z / Math.sqrt(2)));
  }

  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      const runningExperiments = Array.from(this.experiments.values()).filter(
        (e) => e.status === 'running'
      );

      for (const experiment of runningExperiments) {
        try {
          await this.analyzeExperiment(experiment);

          // Auto-stop experiment if it has reached conclusive results
          if (
            experiment.results?.winner &&
            experiment.results.confidence > this.CONFIDENCE_THRESHOLD
          ) {
            await this.stopExperiment(experiment.id);
          }
        } catch (error) {
          performanceMonitoring.recordError(error as Error, {
            operation: 'periodicAnalysis',
            experimentId: experiment.id,
          });
        }
      }
    }, this.ANALYSIS_INTERVAL);
  }
}

export const abTesting = ABTestingService.getInstance();
