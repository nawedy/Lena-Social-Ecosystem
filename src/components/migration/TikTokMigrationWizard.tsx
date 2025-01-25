import { MaterialIcons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { AnalyticsService } from '../../services/AnalyticsService';
import { TikTokMigrationService } from '../../services/TikTokMigrationService';

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export function TikTokMigrationWizard() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [options, setOptions] = useState({
    importVideos: true,
    importFollowers: true,
    importAnalytics: true,
    preserveMetadata: true,
    optimizeContent: true,
    scheduleContent: true,
    crossPostToTikTok: false,
  });
  const [steps, setSteps] = useState<MigrationStep[]>([
    {
      id: 'profile',
      title: t('migration.steps.profile.title'),
      description: t('migration.steps.profile.description'),
      icon: 'person',
      status: 'pending',
    },
    {
      id: 'videos',
      title: t('migration.steps.videos.title'),
      description: t('migration.steps.videos.description'),
      icon: 'video-library',
      status: 'pending',
    },
    {
      id: 'followers',
      title: t('migration.steps.followers.title'),
      description: t('migration.steps.followers.description'),
      icon: 'people',
      status: 'pending',
    },
    {
      id: 'analytics',
      title: t('migration.steps.analytics.title'),
      description: t('migration.steps.analytics.description'),
      icon: 'analytics',
      status: 'pending',
    },
    {
      id: 'optimization',
      title: t('migration.steps.optimization.title'),
      description: t('migration.steps.optimization.description'),
      icon: 'auto-fix-high',
      status: 'pending',
    },
  ]);
  const [_currentStep, _setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (migrationId) {
      const _interval = setInterval(checkMigrationStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [migrationId]);

  const _checkMigrationStatus = async () => {
    if (!migrationId) return;

    try {
      const _migrationService = TikTokMigrationService.getInstance();
      const _status = migrationService.getMigrationStatus(migrationId);

      // Update progress
      setProgress(status.progress);

      // Update step statuses
      setSteps(steps =>
        steps.map(step => {
          if (status.completedSteps.includes(step.id)) {
            return { ...step, status: 'completed' };
          }
          if (step.id === status.currentStep) {
            return { ...step, status: 'in_progress' };
          }
          if (status.errors.some(error => error.includes(step.id))) {
            return { ...step, status: 'failed' };
          }
          return step;
        })
      );

      // Update errors
      setErrors(status.errors);

      // Handle completion
      if (status.status === 'completed') {
        Alert.window.alert(
          t('migration.complete.title'),
          t('migration.complete.message'),
          [{ text: t('common.ok') }]
        );
      }

      // Handle failure
      if (status.status === 'failed') {
        Alert.window.alert(
          t('migration.failed.title'),
          t('migration.failed.message'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  };

  const _startMigration = async () => {
    if (!username) {
      Alert.window.alert(
        t('migration.error.noUsername.title'),
        t('migration.error.noUsername.message'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    try {
      const _migrationService = TikTokMigrationService.getInstance();
      const _id = await migrationService.startMigration(username, options);
      setMigrationId(id);

      // Track migration start
      const _analytics = AnalyticsService.getInstance();
      analytics.trackEvent('migration_started', {
        username,
        options,
      });
    } catch (error) {
      console.error('Error starting migration:', error);
      Alert.window.alert(
        t('migration.error.start.title'),
        t('migration.error.start.message'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const _renderStepIcon = (step: MigrationStep) => {
    const _color = getStepColor(step.status);
    return (
      <MaterialIcons
        name={step.icon}
        size={24}
        color={color}
        style={styles.stepIcon}
      />
    );
  };

  const _getStepColor = (status: MigrationStep['status']) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'in_progress':
        return '#007bff';
      case 'failed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('migration.title')}</Text>
        <Text style={styles.subtitle}>{t('migration.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>{t('migration.username.label')}</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder={t('migration.username.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!migrationId}
        />

        <Text style={styles.sectionTitle}>{t('migration.options.title')}</Text>
        {Object.entries(options).map(([key, value]) => (
          <View key={key} style={styles.option}>
            <Text style={styles.optionLabel}>
              {t(`migration.options.${key}`)}
            </Text>
            <Switch
              value={value}
              onValueChange={newValue =>
                setOptions(prev => ({ ...prev, [key]: newValue }))
              }
              disabled={!!migrationId}
            />
          </View>
        ))}

        {!migrationId && (
          <TouchableOpacity style={styles.startButton} onPress={startMigration}>
            <Text style={styles.startButtonText}>{t('migration.start')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {migrationId && (
        <View style={styles.progress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
        </View>
      )}

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View
            key={step.id}
            style={[styles.step, index === steps.length - 1 && styles.lastStep]}
          >
            <View style={styles.stepHeader}>
              {renderStepIcon(step)}
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
              {step.status === 'in_progress' && (
                <ActivityIndicator
                  size="small"
                  color="#007bff"
                  style={styles.stepLoader}
                />
              )}
            </View>
            {step.status === 'failed' && (
              <Text style={styles.stepError}>
                {errors.find(error => error.includes(step.id))}
              </Text>
            )}
          </View>
        ))}
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionLabel: {
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progress: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    width: 48,
    textAlign: 'right',
  },
  steps: {
    padding: 16,
  },
  step: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 16,
  },
  lastStep: {
    marginBottom: 0,
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
  },
  stepLoader: {
    marginLeft: 12,
  },
  stepError: {
    marginTop: 8,
    color: '#dc3545',
    fontSize: 14,
  },
});
