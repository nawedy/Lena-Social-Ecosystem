import { supabase } from '$lib/supabaseClient';
import { Configuration, OpenAIApi } from 'openai';
import { env } from '$env/dynamic/private';

interface ContentAnalysis {
  topics: string[];
  sentiment: number;
  toxicity: number;
  language: string;
  entities: {
    type: string;
    text: string;
    relevance: number;
  }[];
  summary: string;
  suggestedTags: string[];
  contentQuality: number;
  contentCategory: string;
  moderationFlags: {
    spam: boolean;
    hate: boolean;
    adult: boolean;
    violence: boolean;
  };
}

interface TopicCluster {
  id: string;
  name: string;
  keywords: string[];
  posts: string[];
  sentiment: number;
  velocity: number;
  engagement: number;
  lastUpdated: Date;
}

class ContentAnalysisService {
  private openai: OpenAIApi;
  private readonly BATCH_SIZE = 100;
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const configuration = new Configuration({
      apiKey: env.OPENAI_API_KEY
    });
    this.openai = new OpenAIApi(configuration);
  }

  async analyzeContent(content: string): Promise<ContentAnalysis> {
    try {
      // Analyze content with OpenAI
      const response = await this.openai.createCompletion({
        model: 'gpt-4',
        prompt: this.buildAnalysisPrompt(content),
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysis = JSON.parse(response.data.choices[0].text || '{}');

      // Store analysis in database
      await this.storeAnalysis(content, analysis);

      return analysis;
    } catch (error) {
      console.error('Error analyzing content:', error);
      throw new Error('Failed to analyze content');
    }
  }

  private buildAnalysisPrompt(content: string): string {
    return `
      Analyze the following content and provide a structured analysis in JSON format:
      
      Content: "${content}"
      
      Provide:
      1. Main topics (array of strings)
      2. Sentiment score (-1 to 1)
      3. Toxicity score (0 to 1)
      4. Language detection
      5. Named entities with type and relevance
      6. Brief summary
      7. Suggested hashtags
      8. Content quality score (0 to 1)
      9. Content category
      10. Moderation flags for:
         - Spam
         - Hate speech
         - Adult content
         - Violence
    `;
  }

  private async storeAnalysis(content: string, analysis: ContentAnalysis) {
    await supabase
      .from('content_analysis')
      .insert({
        content_hash: this.hashContent(content),
        analysis,
        created_at: new Date().toISOString()
      });
  }

  private hashContent(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  async updateTopicClusters(): Promise<void> {
    try {
      // Get recent posts
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(this.BATCH_SIZE);

      if (!posts) return;

      // Group posts by topics
      const clusters = await this.clusterPosts(posts);

      // Update topic clusters in database
      await this.updateClusters(clusters);

      // Update post recommendations
      await this.updateRecommendations(clusters);
    } catch (error) {
      console.error('Error updating topic clusters:', error);
    }
  }

  private async clusterPosts(posts: any[]): Promise<TopicCluster[]> {
    try {
      // Get embeddings for posts
      const embeddings = await this.getEmbeddings(posts);

      // Cluster posts using k-means
      const clusters = await this.kMeansClustering(embeddings);

      // Extract topics and metadata for each cluster
      return this.extractClusterMetadata(clusters, posts);
    } catch (error) {
      console.error('Error clustering posts:', error);
      return [];
    }
  }

  private async getEmbeddings(posts: any[]): Promise<number[][]> {
    const embeddings = await Promise.all(
      posts.map(async post => {
        const response = await this.openai.createEmbedding({
          model: 'text-embedding-ada-002',
          input: post.content
        });
        return response.data.data[0].embedding;
      })
    );
    return embeddings;
  }

  private async kMeansClustering(embeddings: number[][]): Promise<number[]> {
    // Implement k-means clustering algorithm
    // This is a simplified version - in production, use a proper ML library
    const k = Math.min(10, Math.floor(embeddings.length / 10));
    const centroids = embeddings.slice(0, k);
    const assignments = new Array(embeddings.length).fill(0);

    for (let iter = 0; iter < 10; iter++) {
      // Assign points to nearest centroid
      for (let i = 0; i < embeddings.length; i++) {
        let minDist = Infinity;
        let minCluster = 0;

        for (let j = 0; j < centroids.length; j++) {
          const dist = this.euclideanDistance(embeddings[i], centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            minCluster = j;
          }
        }
        assignments[i] = minCluster;
      }

      // Update centroids
      const newCentroids = new Array(k).fill(null).map(() => 
        new Array(embeddings[0].length).fill(0)
      );
      const counts = new Array(k).fill(0);

      for (let i = 0; i < embeddings.length; i++) {
        const cluster = assignments[i];
        counts[cluster]++;
        for (let j = 0; j < embeddings[i].length; j++) {
          newCentroids[cluster][j] += embeddings[i][j];
        }
      }

      for (let i = 0; i < k; i++) {
        if (counts[i] > 0) {
          for (let j = 0; j < newCentroids[i].length; j++) {
            centroids[i][j] = newCentroids[i][j] / counts[i];
          }
        }
      }
    }

    return assignments;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
  }

  private async extractClusterMetadata(
    clusters: number[],
    posts: any[]
  ): Promise<TopicCluster[]> {
    const clusterMap = new Map<number, any[]>();
    
    // Group posts by cluster
    clusters.forEach((cluster, i) => {
      if (!clusterMap.has(cluster)) {
        clusterMap.set(cluster, []);
      }
      clusterMap.get(cluster)?.push(posts[i]);
    });

    // Extract metadata for each cluster
    const clusterMetadata: TopicCluster[] = [];

    for (const [clusterId, clusterPosts] of clusterMap.entries()) {
      // Analyze cluster content
      const combinedContent = clusterPosts
        .map(post => post.content)
        .join('\n');

      const analysis = await this.analyzeContent(combinedContent);

      // Calculate engagement metrics
      const engagement = clusterPosts.reduce(
        (sum, post) => sum + (
          post.metrics?.likes_count || 0 +
          post.metrics?.reposts_count || 0 +
          post.metrics?.replies_count || 0
        ),
        0
      ) / clusterPosts.length;

      // Calculate velocity (posts per hour)
      const oldestPost = new Date(
        Math.min(...clusterPosts.map(p => new Date(p.created_at).getTime()))
      );
      const newestPost = new Date(
        Math.max(...clusterPosts.map(p => new Date(p.created_at).getTime()))
      );
      const hoursDiff = (newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60);
      const velocity = clusterPosts.length / (hoursDiff || 1);

      clusterMetadata.push({
        id: clusterId.toString(),
        name: analysis.topics[0] || 'Untitled Topic',
        keywords: analysis.suggestedTags,
        posts: clusterPosts.map(p => p.id),
        sentiment: analysis.sentiment,
        velocity,
        engagement,
        lastUpdated: new Date()
      });
    }

    return clusterMetadata;
  }

  private async updateClusters(clusters: TopicCluster[]): Promise<void> {
    for (const cluster of clusters) {
      await supabase
        .from('topic_clusters')
        .upsert({
          id: cluster.id,
          name: cluster.name,
          keywords: cluster.keywords,
          posts: cluster.posts,
          sentiment: cluster.sentiment,
          velocity: cluster.velocity,
          engagement: cluster.engagement,
          last_updated: cluster.lastUpdated.toISOString()
        });
    }
  }

  private async updateRecommendations(clusters: TopicCluster[]): Promise<void> {
    // Get user interests
    const { data: userInterests } = await supabase
      .from('user_interests')
      .select('*');

    if (!userInterests) return;

    // Update recommendations for each user
    for (const interest of userInterests) {
      const relevantClusters = clusters
        .filter(cluster => 
          cluster.keywords.some(keyword => 
            interest.topics.includes(keyword)
          )
        )
        .sort((a, b) => b.engagement - a.engagement);

      await supabase
        .from('content_recommendations')
        .upsert({
          user_id: interest.user_id,
          recommended_posts: relevantClusters
            .flatMap(cluster => cluster.posts)
            .slice(0, 50),
          updated_at: new Date().toISOString()
        });
    }
  }

  startPeriodicUpdates(): void {
    setInterval(() => {
      this.updateTopicClusters();
    }, this.UPDATE_INTERVAL);
  }
}

export const contentAnalysisService = new ContentAnalysisService(); 