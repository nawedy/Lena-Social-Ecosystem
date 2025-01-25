import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';

import { ContentTemplate } from '../../services/ContentTemplateService';
import { TemplateRecommendationService } from '../../services/TemplateRecommendationService';

interface TemplateRecommendationsProps {
  userId: string;
  currentTemplateId?: string;
  currentCategory?: string;
  onTemplateSelect: (templateId: string) => void;
}

export function TemplateRecommendations({
  userId,
  currentTemplateId,
  currentCategory,
  onTemplateSelect,
}: TemplateRecommendationsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [similarTemplates, setSimilarTemplates] = useState<any[]>([]);
  const [trendingTemplates, setTrendingTemplates] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<
    'recommended' | 'similar' | 'trending'
  >('recommended');
  const [refreshing, setRefreshing] = useState(false);

  const _recommendationService = TemplateRecommendationService.getInstance();
  const _scrollY = new Animated.Value(0);

  useEffect(() => {
    loadRecommendations();
  }, [userId, currentTemplateId, currentCategory]);

  const _loadRecommendations = async () => {
    setLoading(true);
    try {
      const [recommended, similar, trending] = await Promise.all([
        recommendationService.getRecommendations({
          userId,
          currentTemplateId,
          currentCategory,
        }),
        currentTemplateId
          ? recommendationService.getSimilarTemplates(currentTemplateId)
          : Promise.resolve([]),
        recommendationService.getTrendingTemplates({
          category: currentCategory,
        }),
      ]);

      setRecommendations(recommended);
      setSimilarTemplates(similar);
      setTrendingTemplates(trending);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const _handleRefresh = async () => {
    setRefreshing(true);
    await loadRecommendations();
    setRefreshing(false);
  };

  const _renderTemplateCard = (template: any) => (
    <TouchableOpacity
      key={template.templateId}
      style={styles.templateCard}
      onPress={() => onTemplateSelect(template.templateId)}
    >
      <LinearGradient
        colors={['#f8f9fa', '#ffffff']}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{template.name}</Text>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>
                {(template.score * 100).toFixed(0)}%
              </Text>
              <Text style={styles.matchText}>{t('recommendations.match')}</Text>
            </View>
          </View>
          <View style={styles.confidenceContainer}>
            <Ionicons
              name="analytics"
              size={16}
              color={getConfidenceColor(template.confidence)}
            />
            <Text style={styles.confidenceText}>
              {(template.confidence * 100).toFixed(0)}%{' '}
              {t('recommendations.confidence')}
            </Text>
          </View>
        </View>

        <View style={styles.reasonsContainer}>
          {template.reasons.map((reason: string, index: number) => (
            <View key={index} style={styles.reasonChip}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryText}>{template.category}</Text>
          </View>
          <View style={styles.tagsContainer}>
            {template.tags.slice(0, 3).map((tag: string, index: number) => (
              <View key={index} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const _renderSectionHeader = (
    title: string,
    count: number,
    section: 'recommended' | 'similar' | 'trending'
  ) => (
    <TouchableOpacity
      style={[
        styles.sectionHeader,
        selectedSection === section && styles.selectedSection,
      ]}
      onPress={() => setSelectedSection(section)}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionsContainer}>
        {renderSectionHeader(
          t('recommendations.forYou'),
          recommendations.length,
          'recommended'
        )}
        {currentTemplateId &&
          renderSectionHeader(
            t('recommendations.similar'),
            similarTemplates.length,
            'similar'
          )}
        {renderSectionHeader(
          t('recommendations.trending'),
          trendingTemplates.length,
          'trending'
        )}
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
          }
        )}
        scrollEventThrottle={16}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      >
        {selectedSection === 'recommended' &&
          recommendations.map(renderTemplateCard)}
        {selectedSection === 'similar' &&
          similarTemplates.map(renderTemplateCard)}
        {selectedSection === 'trending' &&
          trendingTemplates.map(renderTemplateCard)}

        {getSelectedTemplates().length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {t('recommendations.noTemplates')}
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );

  function getSelectedTemplates() {
    switch (selectedSection) {
      case 'recommended':
        return recommendations;
      case 'similar':
        return similarTemplates;
      case 'trending':
        return trendingTemplates;
      default:
        return [];
    }
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#28a745';
    if (confidence >= 0.6) return '#ffc107';
    return '#dc3545';
  }
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionsContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  selectedSection: {
    backgroundColor: '#007AFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  templateCard: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardGradient: {
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginRight: 4,
  },
  matchText: {
    fontSize: 12,
    color: '#666',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#666',
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  reasonChip: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 12,
    color: '#495057',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
  },
  tagChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});
