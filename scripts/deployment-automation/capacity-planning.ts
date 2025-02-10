import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MetricsService } from '../utils/metrics';
import { AnomalyDetector } from '../utils/anomaly-detector';
import { MachineLearningService } from '../utils/ml-service';

const execAsync = promisify(exec);

interface CapacityConfig {
  predictionWindow: number; // hours
  updateInterval: number; // minutes
  thresholds: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  autoScaling: {
    enabled: boolean;
    maxScaleUp: number; // percentage
    cooldownPeriod: number; // minutes
  };
  costOptimization: {
    enabled: boolean;
    budgetLimit: number;
    savingsTarget: number;
  };
}

interface ResourcePrediction {
  timestamp: Date;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  confidence: number;
}

interface ScalingRecommendation {
  resource: string;
  action: 'scale_up' | 'scale_down' | 'no_action';
  amount: number;
  priority: number;
  reason: string;
  estimatedCost: number;
}

export class CapacityPlanningService {
  private config: CapacityConfig;
  private metrics: MetricsService;
  private mlService: MachineLearningService;
  private anomalyDetector: AnomalyDetector;
  private lastScaling: Map<string, Date>;

  constructor(config: CapacityConfig) {
    this.config = config;
    this.metrics = new MetricsService('capacity_planning');
    this.mlService = new MachineLearningService();
    this.anomalyDetector = new AnomalyDetector();
    this.lastScaling = new Map();
    this.initializeCapacityPlanning();
  }

  private async initializeCapacityPlanning(): Promise<void> {
    // Start periodic capacity analysis
    setInterval(async () => {
      await this.analyzeFutureCapacity();
    }, this.config.updateInterval * 60 * 1000);

    // Start cost optimization if enabled
    if (this.config.costOptimization.enabled) {
      setInterval(async () => {
        await this.optimizeCosts();
      }, 24 * 60 * 60 * 1000); // Daily
    }
  }

  async analyzeFutureCapacity(): Promise<void> {
    try {
      // Get historical metrics
      const historicalData = await this.metrics.getHistoricalData();
      
      // Generate predictions
      const predictions = await this.predictResourceNeeds(historicalData);
      
      // Analyze predictions and generate recommendations
      const recommendations = await this.generateRecommendations(predictions);
      
      // Apply recommendations if auto-scaling is enabled
      if (this.config.autoScaling.enabled) {
        await this.applyRecommendations(recommendations);
      }

      // Record predictions and recommendations
      await this.recordAnalysis(predictions, recommendations);
      
    } catch (error) {
      logger.error('Capacity analysis failed:', error);
      throw error;
    }
  }

  private async predictResourceNeeds(
    historicalData: any[]
  ): Promise<ResourcePrediction[]> {
    const predictions: ResourcePrediction[] = [];
    
    try {
      // Use ML service to predict future resource needs
      const features = this.extractFeatures(historicalData);
      const predictionWindow = this.config.predictionWindow;
      
      for (let hour = 1; hour <= predictionWindow; hour++) {
        const prediction = await this.mlService.predict('resource_usage', {
          features,
          horizon: hour
        });

        predictions.push({
          timestamp: new Date(Date.now() + hour * 3600000),
          resources: {
            cpu: prediction.cpu,
            memory: prediction.memory,
            storage: prediction.storage,
            network: prediction.network
          },
          confidence: prediction.confidence
        });
      }

      return predictions;
    } catch (error) {
      logger.error('Resource prediction failed:', error);
      throw error;
    }
  }

  private async generateRecommendations(
    predictions: ResourcePrediction[]
  ): Promise<ScalingRecommendation[]> {
    const recommendations: ScalingRecommendation[] = [];
    
    for (const prediction of predictions) {
      // Check each resource type against thresholds
      for (const [resource, value] of Object.entries(prediction.resources)) {
        const threshold = this.config.thresholds[resource as keyof typeof this.config.thresholds];
        
        if (value > threshold * 0.8) {
          // Resource might need scaling up
          recommendations.push(await this.createScalingRecommendation(
            resource,
            'scale_up',
            value,
            threshold,
            prediction
          ));
        } else if (value < threshold * 0.4) {
          // Resource might be over-provisioned
          recommendations.push(await this.createScalingRecommendation(
            resource,
            'scale_down',
            value,
            threshold,
            prediction
          ));
        }
      }
    }

    // Sort recommendations by priority
    return this.prioritizeRecommendations(recommendations);
  }

  private async applyRecommendations(
    recommendations: ScalingRecommendation[]
  ): Promise<void> {
    for (const recommendation of recommendations) {
      try {
        // Check cooldown period
        if (this.isInCooldown(recommendation.resource)) {
          continue;
        }

        // Verify recommendation with anomaly detection
        const isAnomaly = await this.anomalyDetector.check({
          type: 'scaling_recommendation',
          resource: recommendation.resource,
          action: recommendation.action,
          amount: recommendation.amount
        });

        if (!isAnomaly) {
          await this.executeScaling(recommendation);
          this.lastScaling.set(recommendation.resource, new Date());
        }
      } catch (error) {
        logger.error(`Failed to apply recommendation for ${recommendation.resource}:`, error);
      }
    }
  }

  private async optimizeCosts(): Promise<void> {
    try {
      const currentCosts = await this.getCurrentCosts();
      const resourceUtilization = await this.getResourceUtilization();
      
      // Find optimization opportunities
      const opportunities = this.findCostOptimizations(
        currentCosts,
        resourceUtilization
      );

      // Apply cost-saving measures
      for (const opportunity of opportunities) {
        if (opportunity.savings > 0 && 
            opportunity.risk < 0.2) { // 20% risk threshold
          await this.applyCostOptimization(opportunity);
        }
      }
    } catch (error) {
      logger.error('Cost optimization failed:', error);
    }
  }

  private async executeScaling(
    recommendation: ScalingRecommendation
  ): Promise<void> {
    const scalingCommand = this.generateScalingCommand(recommendation);
    
    try {
      await execAsync(scalingCommand);
      
      // Record scaling action
      await this.metrics.recordScaling({
        resource: recommendation.resource,
        action: recommendation.action,
        amount: recommendation.amount,
        timestamp: new Date(),
        reason: recommendation.reason
      });
      
    } catch (error) {
      logger.error('Scaling execution failed:', error);
      throw error;
    }
  }

  private isInCooldown(resource: string): boolean {
    const lastScaleTime = this.lastScaling.get(resource);
    if (!lastScaleTime) return false;

    const cooldownMs = this.config.autoScaling.cooldownPeriod * 60 * 1000;
    return Date.now() - lastScaleTime.getTime() < cooldownMs;
  }

  private prioritizeRecommendations(
    recommendations: ScalingRecommendation[]
  ): ScalingRecommendation[] {
    return recommendations.sort((a, b) => {
      // Sort by priority and estimated cost impact
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.estimatedCost - b.estimatedCost;
    });
  }

  private async createScalingRecommendation(
    resource: string,
    action: 'scale_up' | 'scale_down',
    currentValue: number,
    threshold: number,
    prediction: ResourcePrediction
  ): Promise<ScalingRecommendation> {
    const amount = this.calculateScalingAmount(
      action,
      currentValue,
      threshold
    );

    return {
      resource,
      action,
      amount,
      priority: this.calculatePriority(resource, action, currentValue, threshold),
      reason: `${resource} ${action === 'scale_up' ? 'utilization high' : 'underutilized'}`,
      estimatedCost: await this.estimateScalingCost(resource, action, amount)
    };
  }
} 