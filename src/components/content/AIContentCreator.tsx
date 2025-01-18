import { Ionicons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { APIUsageService, UsageQuota } from '../../services/APIUsageService';
import {
  ContentGenerationService,
  GeneratedContent,
} from '../../services/ContentGenerationService';

interface AIContentCreatorProps {
  userId: string;
  onContentGenerated: (content: GeneratedContent) => void;
}

type ContentType = 'text' | 'image' | 'video';
type AIProvider = 'openai' | 'anthropic' | 'google';

interface ContentGenerationError extends Error {
  provider?: string;
  contentType?: ContentType;
  details?: Record<string, unknown>;
}

interface QuotaCheckResult {
  hasQuota: boolean;
  remainingQuota?: number;
  error?: string;
}

export function AIContentCreator({ userId, onContentGenerated }: AIContentCreatorProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentType>('text');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [contentStyle, setContentStyle] = useState('');
  const [error, setError] = useState<ContentGenerationError | null>(null);

  const _contentGenService = ContentGenerationService.getInstance();
  const _apiUsageService = APIUsageService.getInstance();

  const _checkQuota = async (provider: AIProvider): Promise<QuotaCheckResult> => {
    try {
      const quota: UsageQuota = await apiUsageService.checkQuota(userId, provider);
      if (!quota.hasQuota) {
        Alert.window.alert(t('error'), t('errors.quotaExceeded'), [
          {
            text: t('viewUsage'),
            onPress: () => {
              /* Navigate to usage stats */
            },
          },
          { text: t('ok'), style: 'cancel' },
        ]);
        return { hasQuota: false, remainingQuota: quota.remaining };
      }
      return { hasQuota: true, remainingQuota: quota.remaining };
    } catch (err) {
      const _error = err instanceof Error ? err : new Error('Failed to check quota');
      console.error('Error checking quota:', error);
      return { hasQuota: false, error: error.message };
    }
  };

  const _trackUsage = async (
    provider: AIProvider,
    operation: string,
    units: number,
    cost: number
  ): Promise<void> => {
    try {
      await apiUsageService.trackUsage(userId, provider, operation, units, cost);
    } catch (err) {
      console.error('Error tracking usage:', err);
      // Don't throw here, just log the error as this is not critical
    }
  };

  const _generateContent = async (): Promise<void> => {
    if (!prompt) {
      Alert.window.alert(t('error'), t('errors.promptRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider: AIProvider = 'openai'; // Could be made configurable
      const _quotaCheck = await checkQuota(provider);

      if (!quotaCheck.hasQuota) {
        if (quotaCheck.error) {
          throw new Error(quotaCheck.error);
        }
        return;
      }

      let content: GeneratedContent;
      switch (activeTab) {
        case 'text':
          content = await contentGenService.generateCaption(prompt, contentStyle);
          await trackUsage(provider, 'generateCaption', prompt.length, 0.002 * prompt.length);
          break;

        case 'image':
          content = await contentGenService.generateImage(prompt, contentStyle);
          await trackUsage(provider, 'generateImage', 1, 0.02);
          break;

        case 'video':
          content = await contentGenService.generateVideoIdeas(prompt);
          await trackUsage(provider, 'generateVideoIdeas', prompt.length, 0.002 * prompt.length);
          break;

        default:
          throw new Error('Invalid content type');
      }

      setGeneratedContent(content);
      onContentGenerated(content);
    } catch (err) {
      console.error('Error generating content:', err);
      const error: ContentGenerationError =
        err instanceof Error ? err : new Error('Failed to generate content');
      error.contentType = activeTab;
      error.provider = 'openai';
      setError(error);
      Alert.window.alert(t('error'), t('errors.generationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const _debouncedGenerate = useCallback(
    debounce(generateContent, 500, { leading: true, trailing: false }),
    [prompt, contentStyle, activeTab]
  );

  const _renderTextTab = () => (
    <View>
      <TextInput
        style={styles.styleInput}
        placeholder={t('contentCreator.stylePrompt')}
        value={contentStyle}
        onChangeText={setContentStyle}
      />
      {generatedContent && (
        <View style={styles.generatedContent}>
          <Text style={styles.generatedText}>{generatedContent.text}</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              /* Copy to clipboard */
            }}
          >
            <Ionicons name='copy-outline' size={20} color='#007AFF' />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const _renderImageTab = () => (
    <View>
      <TextInput
        style={styles.styleInput}
        placeholder={t('contentCreator.stylePrompt')}
        value={contentStyle}
        onChangeText={setContentStyle}
      />
      {generatedContent && (
        <View style={styles.generatedContent}>
          <Image
            source={{ uri: generatedContent.image }}
            style={styles.generatedImage}
            resizeMode='contain'
          />
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => {
              /* Download image */
            }}
          >
            <Ionicons name='download-outline' size={20} color='#fff' />
            <Text style={styles.downloadButtonText}>{t('contentCreator.download')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const _renderVideoTab = () => (
    <View>
      {generatedContent && (
        <View style={styles.generatedContent}>
          <ScrollView style={styles.ideaList}>
            {generatedContent.videoIdeas.map((idea: string, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.ideaItem}
                onPress={() => onContentGenerated({ videoIdeas: [idea] })}
              >
                <Text style={styles.ideaText}>{idea}</Text>
                <Ionicons name='chevron-forward' size={20} color='#666' />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'text' && styles.activeTab]}
          onPress={() => setActiveTab('text')}
        >
          <Ionicons name='text' size={24} color={activeTab === 'text' ? '#007AFF' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'image' && styles.activeTab]}
          onPress={() => setActiveTab('image')}
        >
          <Ionicons name='image' size={24} color={activeTab === 'image' ? '#007AFF' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'video' && styles.activeTab]}
          onPress={() => setActiveTab('video')}
        >
          <Ionicons name='videocam' size={24} color={activeTab === 'video' ? '#007AFF' : '#666'} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.promptInput}
        placeholder={t('contentCreator.promptPlaceholder')}
        value={prompt}
        onChangeText={setPrompt}
        multiline
      />

      <TouchableOpacity
        style={[styles.generateButton, loading && styles.generateButtonDisabled]}
        onPress={debouncedGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color='#fff' />
        ) : (
          <>
            <Ionicons name='flash' size={20} color='#fff' />
            <Text style={styles.generateButtonText}>{t('contentCreator.generate')}</Text>
          </>
        )}
      </TouchableOpacity>

      <ScrollView style={styles.contentContainer}>
        {activeTab === 'text' && renderTextTab()}
        {activeTab === 'image' && renderImageTab()}
        {activeTab === 'video' && renderVideoTab()}
      </ScrollView>
    </View>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  promptInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  styleInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
  },
  generatedContent: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  generatedText: {
    fontSize: 16,
    lineHeight: 24,
  },
  generatedImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  copyButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ideaList: {
    maxHeight: 300,
  },
  ideaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ideaText: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
});
