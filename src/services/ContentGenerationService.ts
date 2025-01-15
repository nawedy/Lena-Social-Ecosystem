import { OpenAI } from 'openai';
import { StabilityAI } from '@stability-ai/api';
import { Replicate } from 'replicate';
import * as SecureStore from 'expo-secure-store';

export class ContentGenerationService {
  private static instance: ContentGenerationService;
  private openai: OpenAI | null = null;
  private stabilityAI: StabilityAI | null = null;
  private replicate: Replicate | null = null;

  private constructor() {
    this.initializeAPIs();
  }

  public static getInstance(): ContentGenerationService {
    if (!ContentGenerationService.instance) {
      ContentGenerationService.instance = new ContentGenerationService();
    }
    return ContentGenerationService.instance;
  }

  private async initializeAPIs() {
    const apiKeys = await this.getAPIKeys();
    
    if (apiKeys.openai) {
      this.openai = new OpenAI({ apiKey: apiKeys.openai });
    }
    
    if (apiKeys.stability) {
      this.stabilityAI = new StabilityAI({ apiKey: apiKeys.stability });
    }
    
    if (apiKeys.replicate) {
      this.replicate = new Replicate({ auth: apiKeys.replicate });
    }
  }

  // Text Generation
  async generateCaption(prompt: string, style?: string): Promise<string> {
    if (!this.openai) throw new Error('OpenAI API not configured');

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a creative social media caption writer. ${style ? `Write in a ${style} style.` : ''}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  }

  async generateHashtags(content: string): Promise<string[]> {
    if (!this.openai) throw new Error('OpenAI API not configured');

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Generate relevant, trending hashtags for the given content. Return as a comma-separated list."
        },
        {
          role: "user",
          content
        }
      ],
      temperature: 0.7,
    });

    return (response.choices[0].message.content || '').split(',').map(tag => tag.trim());
  }

  // Image Generation
  async generateImage(prompt: string, style?: string): Promise<string> {
    if (!this.openai) throw new Error('OpenAI API not configured');

    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: `${prompt} ${style ? `in ${style} style` : ''}`,
      n: 1,
      size: "1024x1024",
    });

    return response.data[0].url || '';
  }

  async enhanceImage(imageUrl: string): Promise<string> {
    if (!this.replicate) throw new Error('Replicate API not configured');

    const output = await this.replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: imageUrl,
          prompt: "enhance, high quality, detailed",
        }
      }
    );

    return output.toString();
  }

  // Video Generation
  async generateVideoIdeas(theme: string): Promise<string[]> {
    if (!this.openai) throw new Error('OpenAI API not configured');

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Generate creative video ideas for social media content. Return as a numbered list."
        },
        {
          role: "user",
          content: `Theme: ${theme}`
        }
      ],
      temperature: 0.8,
    });

    return (response.choices[0].message.content || '').split('\n').filter(line => line.trim());
  }

  // Trend Analysis
  async analyzeTrends(): Promise<any> {
    if (!this.openai) throw new Error('OpenAI API not configured');

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Analyze current social media trends and provide insights. Return as JSON."
        },
        {
          role: "user",
          content: "What are the current trending topics and content formats?"
        }
      ],
      temperature: 0.6,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  // API Key Management
  private async getAPIKeys(): Promise<Record<string, string>> {
    const keys: Record<string, string> = {};
    
    try {
      const openaiKey = await SecureStore.getItemAsync('openai_api_key');
      const stabilityKey = await SecureStore.getItemAsync('stability_api_key');
      const replicateKey = await SecureStore.getItemAsync('replicate_api_key');
      
      if (openaiKey) keys.openai = openaiKey;
      if (stabilityKey) keys.stability = stabilityKey;
      if (replicateKey) keys.replicate = replicateKey;
    } catch (error) {
      console.error('Error retrieving API keys:', error);
    }
    
    return keys;
  }

  async updateAPIKey(provider: string, key: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(`${provider}_api_key`, key);
      await this.initializeAPIs();
    } catch (error) {
      console.error('Error updating API key:', error);
      throw error;
    }
  }

  async testAPIConnection(provider: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'openai':
          if (!this.openai) return false;
          await this.openai.models.list();
          break;
        case 'stability':
          if (!this.stabilityAI) return false;
          // Add stability test
          break;
        case 'replicate':
          if (!this.replicate) return false;
          // Add replicate test
          break;
        default:
          return false;
      }
      return true;
    } catch (error) {
      console.error(`Error testing ${provider} API connection:`, error);
      return false;
    }
  }
}
