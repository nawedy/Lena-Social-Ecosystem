import { supabase } from '$lib/supabaseClient';
import { PrivacyService } from './PrivacyService';

interface ExternalPlatform {
  id: string;
  name: string;
  baseUrl: string;
  apiVersion: string;
  authType: 'oauth' | 'api_key' | 'lti';
  privacyLevel: 'high' | 'medium' | 'low';
}

interface ContentMapping {
  externalId: string;
  platformId: string;
  internalId: string;
  type: 'course' | 'module' | 'assessment';
  metadata: Record<string, any>;
  privacySettings: {
    dataSharing: string[];
    trackingAllowed: boolean;
    storageLocation: 'local' | 'external' | 'hybrid';
  };
}

export class ExternalContentService {
  private readonly privacyService: PrivacyService;
  private readonly supportedPlatforms: ExternalPlatform[] = [
    {
      id: 'linkedin_learning',
      name: 'LinkedIn Learning (formerly Lynda)',
      baseUrl: 'https://api.linkedin.com/v2/learningAssets',
      apiVersion: '2.0',
      authType: 'oauth',
      privacyLevel: 'high'
    },
    {
      id: 'coursera',
      name: 'Coursera',
      baseUrl: 'https://api.coursera.org/api',
      apiVersion: '2.0',
      authType: 'oauth',
      privacyLevel: 'high'
    },
    {
      id: 'google_upskill',
      name: 'Google Digital Skills',
      baseUrl: 'https://digitalskills.google.com/api',
      apiVersion: '1.0',
      authType: 'oauth',
      privacyLevel: 'medium'
    },
    {
      id: 'udacity',
      name: 'Udacity',
      baseUrl: 'https://api.udacity.com/api/v1',
      apiVersion: '1.0',
      authType: 'api_key',
      privacyLevel: 'high'
    },
    {
      id: 'edx',
      name: 'edX',
      baseUrl: 'https://api.edx.org/v1',
      apiVersion: '1.0',
      authType: 'lti',
      privacyLevel: 'high'
    }
  ];

  constructor() {
    this.privacyService = new PrivacyService();
  }

  async importContent(platformId: string, externalContentId: string, userId: string): Promise<string> {
    try {
      // Get platform configuration
      const platform = this.supportedPlatforms.find(p => p.id === platformId);
      if (!platform) throw new Error('Unsupported platform');

      // Check existing mapping
      const { data: existingMapping } = await supabase
        .from('external_content_mappings')
        .select('internal_id')
        .eq('platform_id', platformId)
        .eq('external_id', externalContentId)
        .single();

      if (existingMapping) return existingMapping.internal_id;

      // Fetch content metadata through privacy proxy
      const metadata = await this.fetchContentMetadata(platform, externalContentId);

      // Create privacy-preserving content wrapper
      const { data: contentMapping, error } = await supabase
        .from('external_content_mappings')
        .insert({
          platform_id: platformId,
          external_id: externalContentId,
          imported_by: userId,
          metadata: this.sanitizeMetadata(metadata),
          privacy_settings: this.getPrivacySettings(platform)
        })
        .select()
        .single();

      if (error) throw error;

      // Create learning path wrapper
      const { data: path, error: pathError } = await supabase
        .from('learning_paths')
        .insert({
          title: metadata.title,
          description: metadata.description,
          type: 'external_course',
          external_mapping_id: contentMapping.id,
          creator_id: userId,
          status: 'active',
          visibility: 'public'
        })
        .select()
        .single();

      if (pathError) throw pathError;

      return path.id;
    } catch (error) {
      console.error('Error importing external content:', error);
      throw error;
    }
  }

  async syncProgress(userId: string, mappingId: string, progress: number): Promise<void> {
    try {
      // Store progress locally without sharing with external platform
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          external_mapping_id: mappingId,
          progress,
          synced_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error syncing progress:', error);
      throw error;
    }
  }

  private async fetchContentMetadata(platform: ExternalPlatform, contentId: string): Promise<any> {
    // Create anonymous session for content fetching
    const proxySession = await this.privacyService.createAnonymousSession();

    try {
      const response = await fetch(`${platform.baseUrl}/content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${proxySession.token}`,
          'X-Privacy-Proxy': 'true'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch content metadata');

      const data = await response.json();
      return this.privacyService.sanitizeData(data);
    } finally {
      await this.privacyService.destroyAnonymousSession(proxySession.id);
    }
  }

  private sanitizeMetadata(metadata: any): any {
    // Remove tracking pixels, analytics scripts, and personal identifiers
    return {
      title: metadata.title,
      description: metadata.description,
      duration: metadata.duration,
      topics: metadata.topics,
      skills: metadata.skills,
      level: metadata.level,
      updatedAt: metadata.updatedAt
    };
  }

  private getPrivacySettings(platform: ExternalPlatform): any {
    const baseSettings = {
      dataSharing: ['progress', 'completion'],
      trackingAllowed: false,
      storageLocation: 'local' as const
    };

    switch (platform.privacyLevel) {
      case 'high':
        return {
          ...baseSettings,
          dataSharing: ['completion'],
          encryptContent: true
        };
      case 'medium':
        return {
          ...baseSettings,
          anonymizeData: true
        };
      default:
        return baseSettings;
    }
  }

  getSupportedPlatforms(): ExternalPlatform[] {
    return this.supportedPlatforms;
  }
} 