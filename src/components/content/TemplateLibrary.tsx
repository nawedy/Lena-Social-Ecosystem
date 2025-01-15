import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  ContentTemplate,
  ContentTemplateService,
} from '../../services/ContentTemplateService';

interface TemplateLibraryProps {
  userId: string;
  onSelectTemplate: (template: ContentTemplate) => void;
}

export function TemplateLibrary({
  userId,
  onSelectTemplate,
}: TemplateLibraryProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'text' | 'image' | 'video' | null>(
    null
  );
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const templateService = ContentTemplateService.getInstance();

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [selectedCategory, selectedType]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const loadedTemplates = await templateService.listTemplates({
        category: selectedCategory || undefined,
        type: selectedType || undefined,
        isPublic: true,
        orderBy: 'usageCount',
      });
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const loadedCategories = await templateService.getTemplateCategories();
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = await templateService.searchTemplates(query);
      setTemplates(results);
    } else if (query.length === 0) {
      loadTemplates();
    }
  };

  const renderTemplateGrid = ({ item }: { item: ContentTemplate }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onSelectTemplate(item)}
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
                ? 'text'
                : item.type === 'image'
                ? 'image'
                : 'videocam'
            }
            size={32}
            color="#666"
          />
        </View>
      )}
      <View style={styles.gridItemInfo}>
        <Text style={styles.templateName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.templateCategory} numberOfLines={1}>
          {item.category}
        </Text>
        <View style={styles.templateStats}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.statText}>{item.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="repeat" size={12} color="#666" />
            <Text style={styles.statText}>{item.usageCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTemplateList = ({ item }: { item: ContentTemplate }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => onSelectTemplate(item)}
    >
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
                ? 'text'
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
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.templateMetadata}>
          <Text style={styles.templateCategory}>{item.category}</Text>
          <View style={styles.templateStats}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.statText}>{item.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="repeat" size={12} color="#666" />
              <Text style={styles.statText}>{item.usageCount}</Text>
            </View>
          </View>
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
            name="text"
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
  gridItemInfo: {
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
  templateCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  templateMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});
