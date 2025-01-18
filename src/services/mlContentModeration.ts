import { BskyAgent } from '@atproto/api';
import { LanguageServiceClient } from '@google-cloud/language';
import { Storage } from '@google-cloud/storage';
import { VideoIntelligenceServiceClient } from '@google-cloud/video-intelligence';
import { ImageAnnotatorClient } from '@google-cloud/vision';

import { atproto } from './atproto';

interface ContentAnalysisResult {
  id: string;
  contentType: 'text' | 'image' | 'video';
  contentUri: string;
  timestamp: string;
  scores: {
    toxic?: number;
    severe_toxic?: number;
    obscene?: number;
    threat?: number;
    insult?: number;
    identity_hate?: number;
    spam?: number;
    adult?: number;
    racy?: number;
    violence?: number;
    medical?: number;
    spoof?: number;
  };
  labels: Array<{
    name: string;
    confidence: number;
    category?: string;
  }>;
  entities?: Array<{
    name: string;
    type: string;
    salience: number;
    sentiment: number;
  }>;
  moderationDecision: 'allow' | 'flag' | 'block';
  confidence: number;
}

interface ModerationType {
  name: string;
  threshold: number;
  action: 'allow' | 'flag' | 'block';
}

interface SafeSearchAnnotation {
  adult?: string;
  spoof?: string;
  medical?: string;
  violence?: string;
  racy?: string;
}

interface ExplicitAnnotation {
  frames?: Array<Record<string, string>>;
}

class MLContentModerationService {
  private agent: BskyAgent;
  private languageClient: LanguageServiceClient;
  private visionClient: ImageAnnotatorClient;
  private videoClient: VideoIntelligenceServiceClient;
  private storage: Storage;
  private static instance: MLContentModerationService;

  private moderationTypes: ModerationType[] = [
    { name: 'toxic', threshold: 0.8, action: 'block' },
    { name: 'severe_toxic', threshold: 0.7, action: 'block' },
    { name: 'obscene', threshold: 0.8, action: 'block' },
    { name: 'threat', threshold: 0.7, action: 'block' },
    { name: 'insult', threshold: 0.8, action: 'flag' },
    { name: 'identity_hate', threshold: 0.7, action: 'block' },
    { name: 'spam', threshold: 0.9, action: 'block' },
    { name: 'adult', threshold: 0.8, action: 'block' },
    { name: 'racy', threshold: 0.9, action: 'flag' },
    { name: 'violence', threshold: 0.8, action: 'block' },
    { name: 'medical', threshold: 0.9, action: 'flag' },
    { name: 'spoof', threshold: 0.9, action: 'flag' },
  ];

  private constructor() {
    this.agent = atproto.getAgent();
    this.languageClient = new LanguageServiceClient();
    this.visionClient = new ImageAnnotatorClient();
    this.videoClient = new VideoIntelligenceServiceClient();
    this.storage = new Storage();
  }

  public static getInstance(): MLContentModerationService {
    if (!MLContentModerationService.instance) {
      MLContentModerationService.instance = new MLContentModerationService();
    }
    return MLContentModerationService.instance;
  }

  async analyzeText(text: string, contentUri: string): Promise<ContentAnalysisResult> {
    try {
      const [_syntaxResult] = await this.languageClient.analyzeSyntax({
        document: { content: text, type: 'PLAIN_TEXT' },
      });
      const [_sentimentResult] = await this.languageClient.analyzeSentiment({
        document: { content: text, type: 'PLAIN_TEXT' },
      });
      const [entityResult] = await this.languageClient.analyzeEntitySentiment({
        document: { content: text, type: 'PLAIN_TEXT' },
      });

      // Analyze for toxicity and other attributes
      const scores = await this.analyzeToxicity(text);

      const entities = entityResult.entities?.map((entity) => ({
        name: entity.name || '',
        type: entity.type || '',
        salience: entity.salience || 0,
        sentiment: entity.sentiment?.score || 0,
      }));

      const moderationDecision = this.determineModeration(scores);

      const result: ContentAnalysisResult = {
        id: crypto.randomUUID(),
        contentType: 'text',
        contentUri,
        timestamp: new Date().toISOString(),
        scores,
        labels: [],
        entities,
        moderationDecision: moderationDecision.action,
        confidence: moderationDecision.confidence,
      };

      await this.storeAnalysisResult(result);
      return result;
    } catch (error) {
      console.error('Text analysis error:', error);
      throw error;
    }
  }

  async analyzeImage(imageUrl: string, contentUri: string): Promise<ContentAnalysisResult> {
    try {
      const [_result] = await this.visionClient.safeSearchDetection(imageUrl);
      const [labelResult] = await this.visionClient.labelDetection(imageUrl);

      const safeSearch = result.safeSearchAnnotation || {};
      const scores = this.normalizeVisionScores(safeSearch);

      const labels = (labelResult.labelAnnotations || []).map((label) => ({
        name: label.description || '',
        confidence: label.score || 0,
        category: label.topicality ? 'high-topicality' : 'standard',
      }));

      const moderationDecision = this.determineModeration(scores);

      const result: ContentAnalysisResult = {
        id: crypto.randomUUID(),
        contentType: 'image',
        contentUri,
        timestamp: new Date().toISOString(),
        scores,
        labels,
        moderationDecision: moderationDecision.action,
        confidence: moderationDecision.confidence,
      };

      await this.storeAnalysisResult(result);
      return result;
    } catch (error) {
      console.error('Image analysis error:', error);
      throw error;
    }
  }

  async analyzeVideo(videoUrl: string, contentUri: string): Promise<ContentAnalysisResult> {
    try {
      const [operation] = await this.videoClient.annotateVideo({
        inputUri: videoUrl,
        features: ['EXPLICIT_CONTENT_DETECTION', 'LABEL_DETECTION', 'OBJECT_TRACKING'],
      });

      const [_result] = await operation.promise();

      const explicitAnnotation = result.explicitAnnotation || {};
      const scores = this.normalizeVideoScores(explicitAnnotation);

      const labels = (result.labelAnnotations || []).map((label) => ({
        name: label.entity?.description || '',
        confidence: label.frames?.[0]?.confidence || 0,
        category: label.categoryEntities?.[0]?.description || 'standard',
      }));

      const moderationDecision = this.determineModeration(scores);

      const result: ContentAnalysisResult = {
        id: crypto.randomUUID(),
        contentType: 'video',
        contentUri,
        timestamp: new Date().toISOString(),
        scores,
        labels,
        moderationDecision: moderationDecision.action,
        confidence: moderationDecision.confidence,
      };

      await this.storeAnalysisResult(result);
      return result;
    } catch (error) {
      console.error('Video analysis error:', error);
      throw error;
    }
  }

  private async analyzeToxicity(text: string): Promise<ContentAnalysisResult['scores']> {
    try {
      // Using Cloud Natural Language API for sentiment and content analysis
      const [result] = await this.languageClient.analyzeSentiment({
        document: {
          content: text,
          type: 'PLAIN_TEXT',
        },
      });

      // Convert sentiment scores to toxicity metrics
      const sentimentScore = result.documentSentiment?.score || 0;
      const magnitude = result.documentSentiment?.magnitude || 0;

      return {
        toxic: this.convertSentimentToToxicity(sentimentScore, magnitude),
        severe_toxic: this.calculateSevereToxicity(sentimentScore, magnitude),
        spam: this.calculateSpamProbability(text),
        threat: this.detectThreats(text),
        insult: this.detectInsults(text),
        identity_hate: this.detectIdentityHate(text),
      };
    } catch (error) {
      console.error('Toxicity analysis error:', error);
      throw error;
    }
  }

  private convertSentimentToToxicity(sentiment: number, magnitude: number): number {
    // Convert negative sentiment to toxicity score
    // Sentiment ranges from -1 to 1, we want toxicity from 0 to 1
    return Math.max(0, (-sentiment + 1) / 2) * Math.min(1, magnitude);
  }

  private calculateSevereToxicity(sentiment: number, magnitude: number): number {
    // Severe toxicity is a more stringent version of toxicity
    const toxicity = this.convertSentimentToToxicity(sentiment, magnitude);
    return Math.pow(toxicity, 1.5); // Exponential scaling for severe toxicity
  }

  private calculateSpamProbability(text: string): number {
    // Implement spam detection logic
    // This is a simplified version - in production, use more sophisticated spam detection
    const spamIndicators = [
      text.match(/\b(buy|sell|discount|offer|click|win|free)\b/gi)?.length || 0,
      text.match(/https?:\/\/\S+/g)?.length || 0,
      text.match(/[A-Z]{5,}/g)?.length || 0,
      text.match(/[!?]{2,}/g)?.length || 0,
    ];

    return Math.min(1, spamIndicators.reduce((a, b) => a + b, 0) / 10);
  }

  private detectThreats(text: string): number {
    // Implement threat detection logic
    const threatPatterns = [
      /\b(kill|death|threat|harm|hurt|attack)\b/gi,
      /\b(gun|weapon|bomb|explosive)\b/gi,
      /\b(warning|revenge|payback)\b/gi,
    ];

    const threatMatches = threatPatterns.reduce(
      (count, pattern) => count + (text.match(pattern)?.length || 0),
      0
    );

    return Math.min(1, threatMatches / 5);
  }

  private detectInsults(text: string): number {
    // Implement insult detection logic
    const insultPatterns = [
      /\b(stupid|idiot|dumb|fool|moron)\b/gi,
      /\b(loser|failure|worthless)\b/gi,
      /\b(hate|despise|disgust)\b/gi,
    ];

    const insultMatches = insultPatterns.reduce(
      (count, pattern) => count + (text.match(pattern)?.length || 0),
      0
    );

    return Math.min(1, insultMatches / 3);
  }

  private detectIdentityHate(text: string): number {
    // Implement identity hate detection logic
    // Note: This is a simplified version. In production, use more comprehensive lists and ML models
    const hatePatterns = [
      /\b(racist|sexist|homophobic|transphobic)\b/gi,
      /\b(discrimination|prejudice|bigot)\b/gi,
      /\b(hate group|supremacist)\b/gi,
    ];

    const hateMatches = hatePatterns.reduce(
      (count, pattern) => count + (text.match(pattern)?.length || 0),
      0
    );

    return Math.min(1, hateMatches / 2);
  }

  private normalizeVisionScores(safeSearch: SafeSearchAnnotation): ContentAnalysisResult['scores'] {
    const likelihoodMap: { [key: string]: number } = {
      VERY_UNLIKELY: 0,
      UNLIKELY: 0.25,
      POSSIBLE: 0.5,
      LIKELY: 0.75,
      VERY_LIKELY: 1,
    };

    return {
      adult: likelihoodMap[safeSearch.adult || 'UNLIKELY'],
      spoof: likelihoodMap[safeSearch.spoof || 'UNLIKELY'],
      medical: likelihoodMap[safeSearch.medical || 'UNLIKELY'],
      violence: likelihoodMap[safeSearch.violence || 'UNLIKELY'],
      racy: likelihoodMap[safeSearch.racy || 'UNLIKELY'],
    };
  }

  private normalizeVideoScores(explicitAnnotation: ExplicitAnnotation): ContentAnalysisResult['scores'] {
    const frames = explicitAnnotation.frames || [];
    if (frames.length === 0) return {};

    const averageScores = frames.reduce((acc: Record<string, number>, frame: Record<string, string>) => {
      Object.entries(frame).forEach(([key, value]) => {
        if (typeof value === 'string') {
          acc[key] = (acc[key] || 0) + this.normalizeVideoLikelihood(value);
        }
      });
      return acc;
    }, {});

    Object.keys(averageScores).forEach((key) => {
      averageScores[key] /= frames.length;
    });

    return averageScores;
  }

  private normalizeVideoLikelihood(likelihood: string): number {
    const likelihoodMap: { [key: string]: number } = {
      LIKELIHOOD_UNSPECIFIED: 0,
      VERY_UNLIKELY: 0,
      UNLIKELY: 0.25,
      POSSIBLE: 0.5,
      LIKELY: 0.75,
      VERY_LIKELY: 1,
    };

    return likelihoodMap[likelihood] || 0;
  }

  private determineModeration(scores: ContentAnalysisResult['scores']): {
    action: 'allow' | 'flag' | 'block';
    confidence: number;
  } {
    let highestAction: 'allow' | 'flag' | 'block' = 'allow';
    let highestConfidence = 0;

    for (const type of this.moderationTypes) {
      const score = scores[type.name as keyof typeof scores];
      if (score && score >= type.threshold) {
        if (
          (type.action === 'block' && highestAction !== 'block') ||
          (type.action === 'flag' && highestAction === 'allow')
        ) {
          highestAction = type.action;
          highestConfidence = score;
        }
      }
    }

    return {
      action: highestAction,
      confidence: highestConfidence,
    };
  }

  private async storeAnalysisResult(result: ContentAnalysisResult): Promise<void> {
    try {
      // Store in Cloud Storage for audit trail
      const bucket = this.storage.bucket(process.env.GCP_STORAGE_BUCKET || '');
      const file = bucket.file(`content-analysis/${result.id}.json`);
      await file.save(JSON.stringify(result));

      // Store in AT Protocol
      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.contentAnalysis',
        record: result,
      });
    } catch (error) {
      console.error('Analysis result storage error:', error);
      throw error;
    }
  }
}

export const mlContentModeration = MLContentModerationService.getInstance();
