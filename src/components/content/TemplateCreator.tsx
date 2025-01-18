import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { ContentGenerationService } from '../../services/ContentGenerationService';
import {
  ContentTemplateService,
  ContentTemplate,
  TemplateCategory,
} from '../../services/ContentTemplateService';

interface TemplateCreatorProps {
  userId: string;
  onTemplateCreated: () => void;
  onCancel: () => void;
}

interface TestResult {
  content: string;
  metadata?: Record<string, unknown>;
}

interface ValidationError extends Error {
  field?: string;
}

type TemplateType = 'text' | 'image' | 'video';
type AIProvider = 'openai' | 'anthropic' | 'google' | 'custom';

export function TemplateCreator({ userId, onTemplateCreated, onCancel }: TemplateCreatorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<TemplateType>('text');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [_error, setError] = useState<ValidationError | null>(null);

  const _templateService = ContentTemplateService.getInstance();
  const _contentGenService = ContentGenerationService.getInstance();

  useEffect(() => {
    void loadCategories();
    void loadPopularTags();
  }, []);

  const _loadCategories = async (): Promise<void> => {
    try {
      const _loadedCategories = await templateService.getTemplateCategories();
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      setError(error instanceof Error ? error : new Error('Failed to load categories'));
    }
  };

  const _loadPopularTags = async (): Promise<void> => {
    try {
      const _loadedTags = await templateService.getTemplateTags();
      setPopularTags(loadedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
      setError(error instanceof Error ? error : new Error('Failed to load tags'));
    }
  };

  const _handleAddTag = (): void => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const _handleRemoveTag = (tag: string): void => {
    setTags(tags.filter((t) => t !== tag));
  };

  const _testTemplate = async (): Promise<void> => {
    if (!prompt) {
      Alert.window.alert(t('error'), t('errors.promptRequired'));
      return;
    }

    setLoading(true);
    setTestResult(null);
    setError(null);

    try {
      let result: TestResult;
      switch (type) {
        case 'text':
          result = {
            content: await contentGenService.generateCaption(prompt, style),
          };
          break;
        case 'image':
          result = {
            content: await contentGenService.generateImage(prompt, style),
          };
          break;
        case 'video':
          result = {
            content: await contentGenService.generateVideoIdeas(prompt),
          };
          break;
        default:
          throw new Error('Invalid template type');
      }
      setTestResult(result);
    } catch (error) {
      console.error('Error testing template:', error);
      setError(error instanceof Error ? error : new Error('Failed to test template'));
      Alert.window.alert(t('error'), t('errors.testFailed'));
    } finally {
      setLoading(false);
    }
  };

  const _validateTemplate = (): ValidationError | null => {
    if (!name) {
      return {
        name: 'ValidationError',
        message: t('errors.nameRequired'),
        field: 'name',
      };
    }
    if (!description) {
      return {
        name: 'ValidationError',
        message: t('errors.descriptionRequired'),
        field: 'description',
      };
    }
    if (!category) {
      return {
        name: 'ValidationError',
        message: t('errors.categoryRequired'),
        field: 'category',
      };
    }
    if (!prompt) {
      return {
        name: 'ValidationError',
        message: t('errors.promptRequired'),
        field: 'prompt',
      };
    }
    if (tags.length === 0) {
      return {
        name: 'ValidationError',
        message: t('errors.tagsRequired'),
        field: 'tags',
      };
    }
    return null;
  };

  const _handleCreate = async (): Promise<void> => {
    const _validationError = validateTemplate();
    if (validationError) {
      Alert.window.alert(t('error'), validationError.message);
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const template: Omit<ContentTemplate, 'id'> = {
        name,
        description,
        categoryId: category,
        type,
        prompt,
        style,
        tags,
        isPublic,
        aiProvider,
        createdBy: userId,
        createdAt: new Date(),
        lastModified: new Date(),
        modifiedBy: userId,
        version: 1,
        isActive: true,
        rating: 0,
        usageCount: 0,
        successRate: 0,
      };

      await templateService.createTemplate(template);
      Alert.window.alert(t('success'), t('messages.templateCreated'));
      onTemplateCreated();
    } catch (error) {
      console.error('Error creating template:', error);
      setError(error instanceof Error ? error : new Error('Failed to create template'));
      Alert.window.alert(t('error'), t('errors.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name='close' size={24} color='#666' />
        </TouchableOpacity>
        <Text style={styles.title}>{t('templates.createNew')}</Text>
        <TouchableOpacity onPress={handleCreate} disabled={loading}>
          <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>{t('save')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('templates.namePlaceholder')}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.description')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('templates.descriptionPlaceholder')}
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.category')}</Text>
          <View style={styles.categoryContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryList}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, category === cat.id && styles.categoryChipSelected]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat.id && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[styles.input, styles.categoryInput]}
              value={category}
              onChangeText={setCategory}
              placeholder={t('templates.newCategory')}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.type')}</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'text' && styles.typeButtonSelected]}
              onPress={() => setType('text')}
            >
              <Ionicons name='text' size={24} color={type === 'text' ? '#fff' : '#666'} />
              <Text
                style={[styles.typeButtonText, type === 'text' && styles.typeButtonTextSelected]}
              >
                {t('templates.text')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'image' && styles.typeButtonSelected]}
              onPress={() => setType('image')}
            >
              <Ionicons name='image' size={24} color={type === 'image' ? '#fff' : '#666'} />
              <Text
                style={[styles.typeButtonText, type === 'image' && styles.typeButtonTextSelected]}
              >
                {t('templates.image')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'video' && styles.typeButtonSelected]}
              onPress={() => setType('video')}
            >
              <Ionicons name='videocam' size={24} color={type === 'video' ? '#fff' : '#666'} />
              <Text
                style={[styles.typeButtonText, type === 'video' && styles.typeButtonTextSelected]}
              >
                {t('templates.video')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.prompt')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={t('templates.promptPlaceholder')}
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.style')}</Text>
          <TextInput
            style={styles.input}
            value={style}
            onChangeText={setStyle}
            placeholder={t('templates.stylePlaceholder')}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.tags')}</Text>
          <View style={styles.tagsContainer}>
            <View style={styles.tagInput}>
              <TextInput
                style={styles.input}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder={t('templates.tagsPlaceholder')}
                onSubmitEditing={handleAddTag}
              />
              <TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}>
                <Ionicons name='add' size={24} color='#007AFF' />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagList}>
              {tags.map((tag) => (
                <TouchableOpacity key={tag} style={styles.tag} onPress={() => handleRemoveTag(tag)}>
                  <Text style={styles.tagText}>{tag}</Text>
                  <Ionicons name='close-circle' size={16} color='#666' />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.popularTags}
            >
              {popularTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.popularTag}
                  onPress={() => !tags.includes(tag) && setTags([...tags, tag])}
                >
                  <Text style={styles.popularTagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>{t('templates.public')}</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <Text style={styles.switchDescription}>{t('templates.publicDescription')}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('templates.aiProvider')}</Text>
          <View style={styles.providerContainer}>
            <TouchableOpacity
              style={[
                styles.providerButton,
                aiProvider === 'openai' && styles.providerButtonSelected,
              ]}
              onPress={() => setAiProvider('openai')}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  aiProvider === 'openai' && styles.providerButtonTextSelected,
                ]}
              >
                OpenAI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.providerButton,
                aiProvider === 'anthropic' && styles.providerButtonSelected,
              ]}
              onPress={() => setAiProvider('anthropic')}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  aiProvider === 'anthropic' && styles.providerButtonTextSelected,
                ]}
              >
                Anthropic
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.providerButton,
                aiProvider === 'google' && styles.providerButtonSelected,
              ]}
              onPress={() => setAiProvider('google')}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  aiProvider === 'google' && styles.providerButtonTextSelected,
                ]}
              >
                Google
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.providerButton,
                aiProvider === 'custom' && styles.providerButtonSelected,
              ]}
              onPress={() => setAiProvider('custom')}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  aiProvider === 'custom' && styles.providerButtonTextSelected,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.testButton, loading && styles.testButtonDisabled]}
          onPress={testTemplate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color='#fff' />
          ) : (
            <>
              <Ionicons name='flask' size={20} color='#fff' />
              <Text style={styles.testButtonText}>{t('templates.testTemplate')}</Text>
            </>
          )}
        </TouchableOpacity>

        {testResult && (
          <View style={styles.testResult}>
            <Text style={styles.testResultTitle}>{t('templates.testResult')}</Text>
            {type === 'image' ? (
              <Image
                source={{ uri: testResult.content }}
                style={styles.testResultImage}
                resizeMode='contain'
              />
            ) : (
              <Text style={styles.testResultText}>{testResult.content}</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    gap: 8,
  },
  categoryList: {
    flexGrow: 0,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  categoryInput: {
    marginTop: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    gap: 8,
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  tagsContainer: {
    gap: 8,
  },
  tagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTagButton: {
    padding: 8,
  },
  tagList: {
    flexGrow: 0,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  tagText: {
    fontSize: 14,
    color: '#666',
  },
  popularTags: {
    flexGrow: 0,
  },
  popularTag: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  popularTagText: {
    fontSize: 14,
    color: '#666',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  providerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  providerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  providerButtonSelected: {
    backgroundColor: '#007AFF',
  },
  providerButtonText: {
    fontSize: 14,
    color: '#666',
  },
  providerButtonTextSelected: {
    color: '#fff',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testResult: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  testResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  testResultImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  testResultText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
