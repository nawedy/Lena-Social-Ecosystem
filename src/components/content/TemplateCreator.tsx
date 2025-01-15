import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ContentTemplateService } from '../../services/ContentTemplateService';
import { ContentGenerationService } from '../../services/ContentGenerationService';

interface TemplateCreatorProps {
  userId: string;
  onTemplateCreated: () => void;
  onCancel: () => void;
}

export function TemplateCreator({
  userId,
  onTemplateCreated,
  onCancel,
}: TemplateCreatorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'text' | 'image' | 'video'>('text');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [aiProvider, setAiProvider] = useState('openai');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [popularTags, setPopularTags] = useState<string[]>([]);

  const templateService = ContentTemplateService.getInstance();
  const contentGenService = ContentGenerationService.getInstance();

  useEffect(() => {
    loadCategories();
    loadPopularTags();
  }, []);

  const loadCategories = async () => {
    try {
      const loadedCategories = await templateService.getTemplateCategories();
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPopularTags = async () => {
    try {
      const loadedTags = await templateService.getTemplateTags();
      setPopularTags(loadedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const testTemplate = async () => {
    if (!prompt) {
      Alert.alert(t('error'), t('errors.promptRequired'));
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      let result;
      switch (type) {
        case 'text':
          result = await contentGenService.generateCaption(prompt, style);
          break;
        case 'image':
          result = await contentGenService.generateImage(prompt, style);
          break;
        case 'video':
          result = await contentGenService.generateVideoIdeas(prompt);
          result = Array.isArray(result) ? result[0] : result;
          break;
      }

      setTestResult(result);
    } catch (error) {
      console.error('Error testing template:', error);
      Alert.alert(t('error'), t('errors.templateTestFailed'));
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!name || !description || !category || !prompt) {
      Alert.alert(t('error'), t('errors.allFieldsRequired'));
      return;
    }

    setLoading(true);
    try {
      const templateData = {
        name,
        description,
        category,
        type,
        prompt,
        style,
        tags,
        usageCount: 0,
        rating: 0,
        createdBy: userId,
        isPublic,
        aiProvider,
        previewUrl: testResult && type === 'image' ? testResult : undefined,
      };

      await templateService.createTemplate(templateData);
      Alert.alert(t('success'), t('templates.createSuccess'));
      onTemplateCreated();
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert(t('error'), t('errors.templateSaveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('templates.createNew')}</Text>
        <TouchableOpacity onPress={saveTemplate} disabled={loading}>
          <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
            {t('save')}
          </Text>
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
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat}
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
              <Ionicons
                name="text"
                size={24}
                color={type === 'text' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'text' && styles.typeButtonTextSelected,
                ]}
              >
                {t('templates.text')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'image' && styles.typeButtonSelected]}
              onPress={() => setType('image')}
            >
              <Ionicons
                name="image"
                size={24}
                color={type === 'image' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'image' && styles.typeButtonTextSelected,
                ]}
              >
                {t('templates.image')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'video' && styles.typeButtonSelected]}
              onPress={() => setType('video')}
            >
              <Ionicons
                name="videocam"
                size={24}
                color={type === 'video' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'video' && styles.typeButtonTextSelected,
                ]}
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
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={handleAddTag}
              >
                <Ionicons name="add" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagList}
            >
              {tags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tag}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Text style={styles.tagText}>{tag}</Text>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.popularTags}
            >
              {popularTags.map(tag => (
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
          <Text style={styles.switchDescription}>
            {t('templates.publicDescription')}
          </Text>
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
                aiProvider === 'stability' && styles.providerButtonSelected,
              ]}
              onPress={() => setAiProvider('stability')}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  aiProvider === 'stability' && styles.providerButtonTextSelected,
                ]}
              >
                Stability AI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.providerButton,
                aiProvider === 'replicate' && styles.providerButtonSelected,
              ]}
              onPress={() => setAiProvider('replicate')}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  aiProvider === 'replicate' && styles.providerButtonTextSelected,
                ]}
              >
                Replicate
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
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flask" size={20} color="#fff" />
              <Text style={styles.testButtonText}>
                {t('templates.testTemplate')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {testResult && (
          <View style={styles.testResult}>
            <Text style={styles.testResultTitle}>
              {t('templates.testResult')}
            </Text>
            {type === 'image' ? (
              <Image
                source={{ uri: testResult }}
                style={styles.testResultImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.testResultText}>{testResult}</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
