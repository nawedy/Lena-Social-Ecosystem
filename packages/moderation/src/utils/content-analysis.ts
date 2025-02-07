import * as natural from 'natural';
import type { ContentType } from '../types';

const tokenizer = new natural.WordTokenizer();
const tfidf = new natural.TfIdf();

// Toxic words and patterns (simplified example - in production, use a comprehensive database)
const TOXIC_PATTERNS = [
  /\b(hate|kill|death)\b/i,
  /\b(racist|sexist)\b/i,
  /\b(spam|scam)\b/i
];

export function isToxicContent(content: string, type: ContentType = 'text'): {
  isToxic: boolean;
  confidence: number;
  matches: string[];
} {
  if (type !== 'text') {
    return { isToxic: false, confidence: 0, matches: [] };
  }

  const tokens = tokenizer.tokenize(content.toLowerCase()) || [];
  const matches: string[] = [];
  let toxicScore = 0;

  // Check for toxic patterns
  TOXIC_PATTERNS.forEach(pattern => {
    const match = content.match(pattern);
    if (match) {
      matches.push(match[0]);
      toxicScore += 0.3; // Increment score for each toxic pattern
    }
  });

  // Analyze sentiment
  const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
  const sentiment = analyzer.getSentiment(tokens);
  if (sentiment < -0.5) {
    toxicScore += Math.abs(sentiment) * 0.4;
  }

  // Check for repetitive patterns (potential spam)
  const uniqueTokens = new Set(tokens);
  const repetitionRatio = uniqueTokens.size / tokens.length;
  if (repetitionRatio < 0.3) {
    toxicScore += (1 - repetitionRatio) * 0.3;
  }

  return {
    isToxic: toxicScore > 0.5,
    confidence: Math.min(toxicScore, 1),
    matches
  };
}

export function analyzeContentSimilarity(content: string, previousContents: string[]): number {
  tfidf.addDocument(content);
  previousContents.forEach(doc => tfidf.addDocument(doc));

  let maxSimilarity = 0;
  for (let i = 1; i < previousContents.length + 1; i++) {
    const similarity = natural.JaroWinklerDistance(content, previousContents[i - 1]);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

export function extractMentionsAndTags(content: string): {
  mentions: string[];
  hashtags: string[];
} {
  const mentions = content.match(/@[\w\d]+/g) || [];
  const hashtags = content.match(/#[\w\d]+/g) || [];

  return {
    mentions: mentions.map(m => m.slice(1)),
    hashtags: hashtags.map(h => h.slice(1))
  };
}

export function detectLanguage(content: string): string {
  const languageDetector = new natural.LanguageDetector();
  const [detection] = languageDetector.detect(content);
  return detection?.[0] || 'unknown';
} 