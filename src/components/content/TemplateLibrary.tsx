import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Alert,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  ContentTemplate,
  ContentTemplateService,
  TemplateCategory,
  TemplateListOptions,
  TemplateType,
} from '../../services/ContentTemplateService';
import { debounce } from 'lodash';

interface TemplateLibraryProps {
  userId: string;
  onSelectTemplate: (template: ContentTemplate) => void;
}

interface TemplateLibraryError extends Error {
  operation: 'load' | 'search' | 'filter';
  details?: Record<string, unknown>;
}

type ViewMode = 'grid' | 'list';

export function TemplateLibrary({
  userId,
  onSelectTemplate,
}: TemplateLibraryProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [error, setError] = useState<TemplateLibraryError | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const templateService = ContentTemplateService.getInstance();

  const loadTemplates = async (options?: Partial<TemplateListOptions>): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const listOptions: TemplateListOptions = {
        category: selectedCategory || undefined,
        type: selectedType || undefined,
        isPublic: true,
        orderBy: 'usageCount',
        ...options,
      };

      const loadedTemplates = await templateService.listTemplates(listOptions);
      setTemplates(loadedTemplates);
    } catch (err) {
      console.error('Error loading templates:', err);
      const error: TemplateLibraryError = {
        name: 'LoadError',
        message: 'Failed to load templates',
        operation: 'load',
        details: { selectedCategory, selectedType },
      };
      setError(error);
      Alert.alert(t('error'), t('errors.loadTemplatesFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async (): Promise<void> => {
    try {
      setError(null);
      const loadedCategories = await templateService.getTemplateCategories();
      setCategories(loadedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
      const error: TemplateLibraryError = {
        name: 'LoadError',
        message: 'Failed to load categories',
        operation: 'load',
      };
      setError(error);
      Alert.alert(t('error'), t('errors.loadCategoriesFailed'));
    }
  };

  const handleSearch = useCallback(
    debounce(async (query: string): Promise<void> => {
      try {
        setError(null);
        if (query.length >= 2) {
          const results = await templateService.searchTemplates(query);
          setTemplates(results);
        } else if (query.length === 0) {
          await loadTemplates();
        }
      } catch (err) {
      console.error('Error searching templates:', err);
      const error: TemplateLibraryError = {
        name: 'SearchError',
        message: 'Failed to search templates',
        operation: 'search',
        details: { query },
      };
      setError(error);
      Alert.alert(t('error'), t('errors.searchFailed'));
    }
  }, 300),
    []
  );

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await loadTemplates();
    setRefreshing(false);
  };

  useEffect(() => {
    void loadTemplates();
    void loadCategories();
  }, [selectedCategory, selectedType]);

  const renderTemplateGrid: ListRenderItem<ContentTemplate> = ({ item }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onSelectTemplate(item)}
      testID={`template-${item.id}`}
    >
      {item.previewUrl ? (
        <Image
          source={{ uri: item.previewUrl }}
          style={styles.templatePreview}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.templatePreview, styles.templatePreviewPlaceholder]}>
          <Ionicons
            name={
              item.type === 'text'
                ? 'document-text'
                : item.type === 'image'
                ? 'image'
                : 'videocam'
            }
            size={32}
            color="#666"
          />
        </View>
      )}
      <View style={styles.templateInfo}>
        <Text style={styles.templateName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.templateStats}>
          {t('usageCount', { count: item.usageCount })} • {t('rating', { rating: item.rating })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderTemplateList: ListRenderItem<ContentTemplate> = ({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => onSelectTemplate(item)}
      testID={`template-${item.id}`}
    >
      <View style={styles.listItemContent}>
        {item.previewUrl ? (
          <Image
            source={{ uri: item.previewUrl }}
            style={styles.listItemPreview}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.listItemPreview, styles.templatePreviewPlaceholder]}>
            <Ionicons
              name={
                item.type === 'text'
                  ? 'document-text'
                  : item.type === 'image'
                  ? 'image'
                  : 'videocam'
              }
              size={24}
              color="#666"
            />
          </View>
        )}
        <View style={styles.listItemInfo}>
          <Text style={styles.templateName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.templateDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.templateStats}>
            {t('usageCount', { count: item.usageCount })} • {t('rating', { rating: item.rating })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('templates.searchPlaceholder')}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        >
          <Ionicons
            name={viewMode === 'grid' ? 'list' : 'grid'}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
      >
        <TouchableOpacity
          style={[
            styles.categoryChip,
            !selectedCategory && styles.categoryChipSelected,
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryChipText,
              !selectedCategory && styles.categoryChipTextSelected,
            ]}
          >
            {t('templates.allCategories')}
          </Text>
        </TouchableOpacity>
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipSelected,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextSelected,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.typeFilters}>
        <TouchableOpacity
          style={[
            styles.typeChip,
            !selectedType && styles.typeChipSelected,
          ]}
          onPress={() => setSelectedType(null)}
        >
          <Ionicons name="apps" size={20} color={!selectedType ? '#fff' : '#666'} />
          <Text
            style={[
              styles.typeChipText,
              !selectedType && styles.typeChipTextSelected,
            ]}
          >
            {t('templates.all')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeChip,
            selectedType === 'text' && styles.typeChipSelected,
          ]}
          onPress={() => setSelectedType('text')}
        >
          <Ionicons
            name="document-text"
            size={20}
            color={selectedType === 'text' ? '#fff' : '#666'}
          />
          <Text
            style={[
              styles.typeChipText,
              selectedType === 'text' && styles.typeChipTextSelected,
            ]}
          >
            {t('templates.text')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeChip,
            selectedType === 'image' && styles.typeChipSelected,
          ]}
          onPress={() => setSelectedType('image')}
        >
          <Ionicons
            name="image"
            size={20}
            color={selectedType === 'image' ? '#fff' : '#666'}
          />
          <Text
            style={[
              styles.typeChipText,
              selectedType === 'image' && styles.typeChipTextSelected,
            ]}
          >
            {t('templates.image')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeChip,
            selectedType === 'video' && styles.typeChipSelected,
          ]}
          onPress={() => setSelectedType('video')}
        >
          <Ionicons
            name="videocam"
            size={20}
            color={selectedType === 'video' ? '#fff' : '#666'}
          />
          <Text
            style={[
              styles.typeChipText,
              selectedType === 'video' && styles.typeChipTextSelected,
            ]}
          >
            {t('templates.video')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={templates}
          renderItem={viewMode === 'grid' ? renderTemplateGrid : renderTemplateList}
          keyExtractor={item => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Force re-render when changing view mode
          contentContainerStyle={styles.templateList}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');
const gridItemWidth = (width - 48) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    marginLeft: 8,
    fontSize: 16,
  },
  viewModeButton: {
    padding: 8,
  },
  categoriesContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  typeFilters: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  typeChipSelected: {
    backgroundColor: '#007AFF',
  },
  typeChipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  typeChipTextSelected: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateList: {
    padding: 16,
  },
  gridItem: {
    width: gridItemWidth,
    marginBottom: 16,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templatePreview: {
    width: '100%',
    height: gridItemWidth,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  templatePreviewPlaceholder: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    padding: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listItemContent: {
    flexDirection: 'row',
  },
  listItemPreview: {
    width: 80,
    height: 80,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  listItemInfo: {
    flex: 1,
    padding: 12,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  templateStats: {
    fontSize: 12,
    color: '#666',
  },
});
