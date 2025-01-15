import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { environment } from '../../config/environment';

interface ConfigSection {
  id: string;
  title: string;
  fields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select';
  options?: string[];
  secure?: boolean;
  validation?: (value: string) => boolean;
  placeholder?: string;
  description?: string;
}

export function ConfigurationUI() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState({
    dailyAICost: 0,
    costUsagePercent: 0,
    aiSuccessRate: 0,
    providerStatus: {},
  });

  const configSections: ConfigSection[] = [
    {
      id: 'firebase',
      title: t('config.sections.firebase'),
      fields: [
        { key: 'FIREBASE_API_KEY', label: t('config.firebase.apiKey'), type: 'password', secure: true },
        { key: 'FIREBASE_AUTH_DOMAIN', label: t('config.firebase.authDomain'), type: 'text' },
        { key: 'FIREBASE_PROJECT_ID', label: t('config.firebase.projectId'), type: 'text' },
      ],
    },
    {
      id: 'openai',
      title: t('config.sections.openai'),
      fields: [
        { key: 'OPENAI_API_KEY', label: t('config.openai.apiKey'), type: 'password', secure: true },
        { key: 'OPENAI_ORG_ID', label: t('config.openai.orgId'), type: 'text' },
      ],
    },
    {
      id: 'bluesky',
      title: t('config.sections.bluesky'),
      fields: [
        { key: 'BSKY_HANDLE', label: t('config.bluesky.handle'), type: 'text' },
        { key: 'BSKY_APP_PASSWORD', label: t('config.bluesky.password'), type: 'password', secure: true },
        { key: 'BSKY_RATE_LIMIT', label: t('config.bluesky.rateLimit'), type: 'number' },
      ],
    },
    {
      id: 'social',
      title: t('config.sections.social'),
      fields: [
        { key: 'TWITTER_API_KEY', label: t('config.social.twitterKey'), type: 'password', secure: true },
        { key: 'INSTAGRAM_ACCESS_TOKEN', label: t('config.social.instagramToken'), type: 'password', secure: true },
        { key: 'TIKTOK_ACCESS_TOKEN', label: t('config.social.tiktokToken'), type: 'password', secure: true },
      ],
    },
    {
      id: 'templates',
      title: t('config.sections.templates'),
      fields: [
        { key: 'MAX_TEMPLATES_PER_USER', label: t('config.templates.maxPerUser'), type: 'number' },
        { key: 'TEMPLATE_BACKUP_ENABLED', label: t('config.templates.backupEnabled'), type: 'boolean' },
        { key: 'TEMPLATE_EXPORT_FORMAT', label: t('config.templates.exportFormat'), type: 'select', options: ['json', 'yaml'] },
      ],
    },
    {
      id: 'aiProviders',
      title: t('config.sections.aiProviders'),
      fields: [
        { 
          key: 'PRIMARY_AI_PROVIDER',
          label: t('config.ai.primaryProvider'),
          type: 'select',
          options: ['openai', 'anthropic', 'groq', 'cohere'],
          description: t('config.ai.primaryProviderDesc')
        },
        {
          key: 'OPENAI_API_KEY',
          label: t('config.ai.openaiKey'),
          type: 'password',
          secure: true,
          description: t('config.ai.openaiKeyDesc')
        },
        {
          key: 'ANTHROPIC_API_KEY',
          label: t('config.ai.anthropicKey'),
          type: 'password',
          secure: true
        },
        {
          key: 'RUNWAYML_API_KEY',
          label: t('config.ai.runwayKey'),
          type: 'password',
          secure: true
        },
        {
          key: 'REPLICATE_API_TOKEN',
          label: t('config.ai.replicateToken'),
          type: 'password',
          secure: true
        },
        {
          key: 'GROQ_API_KEY',
          label: t('config.ai.groqKey'),
          type: 'password',
          secure: true
        },
        {
          key: 'STABILITY_API_KEY',
          label: t('config.ai.stabilityKey'),
          type: 'password',
          secure: true
        },
        {
          key: 'MIDJOURNEY_API_KEY',
          label: t('config.ai.midjourneyKey'),
          type: 'password',
          secure: true
        }
      ]
    },
    {
      id: 'aiSettings',
      title: t('config.sections.aiSettings'),
      fields: [
        {
          key: 'LOAD_BALANCE_STRATEGY',
          label: t('config.ai.loadBalance'),
          type: 'select',
          options: ['round-robin', 'cost-based', 'performance-based'],
          description: t('config.ai.loadBalanceDesc')
        },
        {
          key: 'MAX_DAILY_COST',
          label: t('config.ai.maxDailyCost'),
          type: 'number',
          validation: (value) => Number(value) > 0
        },
        {
          key: 'COST_ALERT_THRESHOLD',
          label: t('config.ai.costThreshold'),
          type: 'number',
          validation: (value) => Number(value) > 0 && Number(value) <= 1
        },
        {
          key: 'ENABLE_CONTENT_FILTERING',
          label: t('config.ai.contentFiltering'),
          type: 'boolean'
        },
        {
          key: 'FILTER_THRESHOLD',
          label: t('config.ai.filterThreshold'),
          type: 'number',
          validation: (value) => Number(value) > 0 && Number(value) <= 1
        }
      ]
    },
    // Add more sections as needed
  ];

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const savedConfig: Record<string, any> = {};
      
      // Load non-secure configs from AsyncStorage
      const storedConfig = await AsyncStorage.getItem('app_config');
      if (storedConfig) {
        Object.assign(savedConfig, JSON.parse(storedConfig));
      }

      // Load secure configs from SecureStore
      for (const section of configSections) {
        for (const field of section.fields) {
          if (field.secure) {
            const value = await SecureStore.getItemAsync(field.key);
            if (value) {
              savedConfig[field.key] = value;
            }
          }
        }
      }

      setConfig(savedConfig);
    } catch (error) {
      console.error('Error loading configuration:', error);
      Alert.alert(t('error.title'), t('error.loadConfig'));
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const nonSecureConfig: Record<string, any> = {};
      const secureConfig: Record<string, any> = {};

      // Separate secure and non-secure configs
      Object.entries(config).forEach(([key, value]) => {
        const field = configSections
          .flatMap(section => section.fields)
          .find(f => f.key === key);

        if (field?.secure) {
          secureConfig[key] = value;
        } else {
          nonSecureConfig[key] = value;
        }
      });

      // Save non-secure configs to AsyncStorage
      await AsyncStorage.setItem('app_config', JSON.stringify(nonSecureConfig));

      // Save secure configs to SecureStore
      for (const [key, value] of Object.entries(secureConfig)) {
        await SecureStore.setItemAsync(key, value.toString());
      }

      Alert.alert(t('success.title'), t('success.saveConfig'));
    } catch (error) {
      console.error('Error saving configuration:', error);
      Alert.alert(t('error.title'), t('error.saveConfig'));
    } finally {
      setSaving(false);
    }
  };

  const validateField = (field: ConfigField, value: any): string | null => {
    if (field.validation && !field.validation(value)) {
      return t('error.validation');
    }
    
    switch (field.type) {
      case 'number':
        if (isNaN(Number(value))) {
          return t('error.invalidNumber');
        }
        break;
      case 'select':
        if (field.options && !field.options.includes(value)) {
          return t('error.invalidOption');
        }
        break;
    }

    return null;
  };

  const handleFieldChange = (key: string, value: any, field: ConfigField) => {
    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [key]: error || '',
    }));

    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const filteredSections = configSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.fields.some(field =>
      field.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const renderField = (field: ConfigField) => {
    const value = config[field.key];
    const error = errors[field.key];

    switch (field.type) {
      case 'boolean':
        return (
          <Switch
            value={value}
            onValueChange={v => handleFieldChange(field.key, v, field)}
          />
        );
      case 'select':
        return (
          <View style={styles.selectContainer}>
            {field.options?.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.selectOption,
                  value === option && styles.selectedOption,
                ]}
                onPress={() => handleFieldChange(field.key, option, field)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    value === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      default:
        return (
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value?.toString()}
            onChangeText={v => handleFieldChange(field.key, v, field)}
            secureTextEntry={field.type === 'password'}
            keyboardType={field.type === 'number' ? 'numeric' : 'default'}
            placeholder={field.placeholder}
          />
        );
    }
  };

  const renderAIMetrics = () => (
    <View style={styles.metricsContainer}>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{t('config.ai.dailyCost')}</Text>
        <Text style={styles.metricValue}>
          ${(metrics?.dailyAICost || 0).toFixed(2)}
        </Text>
        <ProgressBar
          progress={metrics?.costUsagePercent || 0}
          color={getCostColor(metrics?.costUsagePercent || 0)}
        />
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{t('config.ai.successRate')}</Text>
        <Text style={styles.metricValue}>
          {(metrics?.aiSuccessRate || 0).toFixed(1)}%
        </Text>
        <ProgressBar
          progress={metrics?.aiSuccessRate || 0}
          color={getSuccessColor(metrics?.aiSuccessRate || 0)}
        />
      </View>
    </View>
  );

  const renderProviderStatus = () => (
    <View style={styles.statusContainer}>
      {Object.entries(metrics?.providerStatus || {}).map(([provider, status]) => (
        <View key={provider} style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
          <Text style={styles.statusLabel}>{provider}</Text>
          <Text style={styles.statusValue}>{getStatusText(status)}</Text>
        </View>
      ))}
    </View>
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
      <View style={styles.header}>
        <Text style={styles.title}>{t('config.title')}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('config.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.content}>
        {filteredSections.map(section => (
          <View key={section.id} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setActiveSection(
                activeSection === section.id ? null : section.id
              )}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Ionicons
                name={activeSection === section.id ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#666"
              />
            </TouchableOpacity>

            {activeSection === section.id && (
              <View style={styles.sectionContent}>
                {section.fields.map(field => (
                  <View key={field.key} style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    {renderField(field)}
                    {field.description && (
                      <Text style={styles.fieldDescription}>
                        {field.description}
                      </Text>
                    )}
                    {errors[field.key] && (
                      <Text style={styles.errorText}>{errors[field.key]}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        {renderAIMetrics()}
        {renderProviderStatus()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={loadConfiguration}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{t('config.reset')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={saveConfiguration}
          disabled={saving || Object.keys(errors).some(key => errors[key])}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('config.save')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  fieldDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#dc3545',
    borderWidth: 1,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  selectOption: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#007AFF',
  },
  selectOptionText: {
    color: '#000',
  },
  selectedOptionText: {
    color: '#fff',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  resetButton: {
    backgroundColor: '#6c757d',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  metricsContainer: {
    padding: 16,
  },
  metricCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusContainer: {
    padding: 16,
  },
  statusItem: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 14,
    color: '#666',
  },
});

const getCostColor = (costUsagePercent: number) => {
  if (costUsagePercent < 0.5) {
    return '#28a745';
  } else if (costUsagePercent < 0.8) {
    return '#ffc107';
  } else {
    return '#dc3545';
  }
};

const getSuccessColor = (successRate: number) => {
  if (successRate < 0.5) {
    return '#dc3545';
  } else if (successRate < 0.8) {
    return '#ffc107';
  } else {
    return '#28a745';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online':
      return '#28a745';
    case 'offline':
      return '#dc3545';
    default:
      return '#ffc107';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
};
