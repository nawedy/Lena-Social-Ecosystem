import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';

import { ContentGenerationService } from '../../services/ContentGenerationService';

interface APIKeyState {
  key: string;
  isVisible: boolean;
  isValid: boolean | null;
  isLoading: boolean;
}

export function APIConfiguration() {
  const { t } = useTranslation();
  const [apis, setApis] = useState<Record<string, APIKeyState>>({
    openai: { key: '', isVisible: false, isValid: null, isLoading: false },
    stability: { key: '', isVisible: false, isValid: null, isLoading: false },
    replicate: { key: '', isVisible: false, isValid: null, isLoading: false },
  });

  const _contentGenService = ContentGenerationService.getInstance();

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const _loadAPIKeys = async () => {
    try {
      const _keys = await Promise.all([
        SecureStore.getItemAsync('openai_api_key'),
        SecureStore.getItemAsync('stability_api_key'),
        SecureStore.getItemAsync('replicate_api_key'),
      ]);

      setApis(prev => ({
        openai: { ...prev.openai, key: keys[0] || '' },
        stability: { ...prev.stability, key: keys[1] || '' },
        replicate: { ...prev.replicate, key: keys[2] || '' },
      }));
    } catch (error) {
      console.error('Error loading API keys:', error);
      Alert.window.alert(t('error'), t('errors.loadingAPIKeys'));
    }
  };

  const _toggleKeyVisibility = (provider: string) => {
    setApis(prev => ({
      ...prev,
      [provider]: { ...prev[provider], isVisible: !prev[provider].isVisible },
    }));
  };

  const _updateAPIKey = async (provider: string, key: string) => {
    setApis(prev => ({
      ...prev,
      [provider]: { ...prev[provider], key, isValid: null },
    }));
  };

  const _testConnection = async (provider: string) => {
    const _apiState = apis[provider];
    if (!apiState.key) {
      Alert.window.alert(t('error'), t('errors.apiKeyRequired'));
      return;
    }

    setApis(prev => ({
      ...prev,
      [provider]: { ...prev[provider], isLoading: true },
    }));

    try {
      await contentGenService.updateAPIKey(provider, apiState.key);
      const _isValid = await contentGenService.testAPIConnection(provider);

      setApis(prev => ({
        ...prev,
        [provider]: { ...prev[provider], isValid, isLoading: false },
      }));

      if (isValid) {
        Alert.window.alert(t('success'), t('settings.apiConnectionSuccess'));
      } else {
        Alert.window.alert(t('error'), t('errors.apiConnectionFailed'));
      }
    } catch (error) {
      console.error(`Error testing ${provider} API:`, error);
      setApis(prev => ({
        ...prev,
        [provider]: { ...prev[provider], isValid: false, isLoading: false },
      }));
      Alert.window.alert(t('error'), t('errors.apiTestFailed'));
    }
  };

  const _renderAPIKeyInput = (provider: string, label: string) => {
    const _apiState = apis[provider];

    return (
      <View style={styles.apiKeyContainer}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={apiState.key}
            onChangeText={text => updateAPIKey(provider, text)}
            placeholder={t('settings.enterAPIKey')}
            secureTextEntry={!apiState.isVisible}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.visibilityButton}
            onPress={() => toggleKeyVisibility(provider)}
          >
            <Ionicons
              name={apiState.isVisible ? 'eye-off' : 'eye'}
              size={24}
              color="#666"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.testButton,
            apiState.isValid === true && styles.testButtonSuccess,
            apiState.isValid === false && styles.testButtonError,
          ]}
          onPress={() => testConnection(provider)}
          disabled={apiState.isLoading}
        >
          {apiState.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={
                  apiState.isValid === true
                    ? 'checkmark-circle'
                    : apiState.isValid === false
                      ? 'alert-circle'
                      : 'radio-button-on'
                }
                size={20}
                color="#fff"
              />
              <Text style={styles.testButtonText}>
                {t('settings.testConnection')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.apiConfiguration')}</Text>
      <Text style={styles.description}>
        {t('settings.apiConfigurationDescription')}
      </Text>

      {renderAPIKeyInput('openai', 'OpenAI API')}
      {renderAPIKeyInput('stability', 'Stability AI API')}
      {renderAPIKeyInput('replicate', 'Replicate API')}

      <View style={styles.infoContainer}>
        <Ionicons name="information-circle" size={20} color="#666" />
        <Text style={styles.infoText}>
          {t('settings.apiKeysSecureStorage')}
        </Text>
      </View>
    </ScrollView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  apiKeyContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  visibilityButton: {
    padding: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  testButtonSuccess: {
    backgroundColor: '#34C759',
  },
  testButtonError: {
    backgroundColor: '#FF3B30',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});
