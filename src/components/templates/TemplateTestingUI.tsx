import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ContentGenerationService } from '../../services/ContentGenerationService';
import { environment } from '../../config/environment';

interface TemplateTestingUIProps {
  templateId: string;
  onTestComplete?: (results: TestResult) => void;
}

interface TestResult {
  success: boolean;
  output: string;
  metrics: {
    executionTime: number;
    tokenCount: number;
    cost: number;
  };
  error?: string;
}

interface TestCase {
  id: string;
  name: string;
  input: Record<string, any>;
  expectedOutput?: string;
  status: 'pending' | 'running' | 'success' | 'failure';
  result?: TestResult;
}

export function TemplateTestingUI({
  templateId,
  onTestComplete,
}: TemplateTestingUIProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [currentInput, setCurrentInput] = useState<Record<string, any>>({});
  const [batchTesting, setBatchTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [selectedTestCase, setSelectedTestCase] = useState<string | null>(null);

  const contentService = ContentGenerationService.getInstance();

  useEffect(() => {
    loadTestCases();
  }, [templateId]);

  const loadTestCases = async () => {
    setLoading(true);
    try {
      // Load saved test cases for this template
      const savedCases = await contentService.getTemplateTestCases(templateId);
      setTestCases(savedCases);
    } catch (error) {
      console.error('Error loading test cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunTest = async (testCase?: TestCase) => {
    const input = testCase ? testCase.input : currentInput;
    setLoading(true);

    try {
      const startTime = Date.now();
      const result = await contentService.generateContent(templateId, input);
      const endTime = Date.now();

      const testResult: TestResult = {
        success: true,
        output: result.content,
        metrics: {
          executionTime: endTime - startTime,
          tokenCount: result.tokenCount,
          cost: result.cost,
        },
      };

      if (testCase) {
        setTestCases(prev =>
          prev.map(tc =>
            tc.id === testCase.id
              ? {
                  ...tc,
                  status: 'success',
                  result: testResult,
                }
              : tc
          )
        );
      }

      onTestComplete?.(testResult);
      return testResult;
    } catch (error) {
      const testResult: TestResult = {
        success: false,
        output: '',
        metrics: {
          executionTime: 0,
          tokenCount: 0,
          cost: 0,
        },
        error: error.message,
      };

      if (testCase) {
        setTestCases(prev =>
          prev.map(tc =>
            tc.id === testCase.id
              ? {
                  ...tc,
                  status: 'failure',
                  result: testResult,
                }
              : tc
          )
        );
      }

      Alert.alert(t('error.title'), error.message);
      return testResult;
    } finally {
      setLoading(false);
    }
  };

  const handleRunAllTests = async () => {
    setBatchTesting(true);
    const results: Record<string, TestResult> = {};

    for (const testCase of testCases) {
      setTestCases(prev =>
        prev.map(tc =>
          tc.id === testCase.id
            ? { ...tc, status: 'running' }
            : tc
        )
      );

      results[testCase.id] = await handleRunTest(testCase);
    }

    setTestResults(results);
    setBatchTesting(false);
  };

  const handleSaveTestCase = async () => {
    if (Object.keys(currentInput).length === 0) {
      Alert.alert(t('error.title'), t('error.noInput'));
      return;
    }

    const newTestCase: TestCase = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Test Case ${testCases.length + 1}`,
      input: currentInput,
      status: 'pending',
    };

    setTestCases(prev => [...prev, newTestCase]);
    setCurrentInput({});
  };

  const handleDeleteTestCase = async (testCaseId: string) => {
    setTestCases(prev => prev.filter(tc => tc.id !== testCaseId));
  };

  const renderTestCase = (testCase: TestCase) => (
    <TouchableOpacity
      key={testCase.id}
      style={[
        styles.testCase,
        selectedTestCase === testCase.id && styles.selectedTestCase,
      ]}
      onPress={() => setSelectedTestCase(testCase.id)}
    >
      <View style={styles.testCaseHeader}>
        <Text style={styles.testCaseName}>{testCase.name}</Text>
        <View style={styles.testCaseActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRunTest(testCase)}
            disabled={loading || batchTesting}
          >
            <Ionicons
              name="play"
              size={20}
              color={loading || batchTesting ? '#ccc' : '#28a745'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteTestCase(testCase.id)}
            disabled={loading || batchTesting}
          >
            <Ionicons
              name="trash"
              size={20}
              color={loading || batchTesting ? '#ccc' : '#dc3545'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.testCaseContent}>
        <Text style={styles.inputLabel}>{t('testing.input')}:</Text>
        <Text style={styles.inputText}>
          {JSON.stringify(testCase.input, null, 2)}
        </Text>

        {testCase.result && (
          <>
            <Text style={styles.outputLabel}>{t('testing.output')}:</Text>
            <Text
              style={[
                styles.outputText,
                !testCase.result.success && styles.errorText,
              ]}
            >
              {testCase.result.error || testCase.result.output}
            </Text>

            <View style={styles.metrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('testing.executionTime')}
                </Text>
                <Text style={styles.metricValue}>
                  {testCase.result.metrics.executionTime}ms
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('testing.tokenCount')}
                </Text>
                <Text style={styles.metricValue}>
                  {testCase.result.metrics.tokenCount}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('testing.cost')}</Text>
                <Text style={styles.metricValue}>
                  ${testCase.result.metrics.cost.toFixed(4)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      <View
        style={[
          styles.statusIndicator,
          getStatusStyle(testCase.status),
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('testing.title')}</Text>
        <TouchableOpacity
          style={[styles.runAllButton, batchTesting && styles.disabledButton]}
          onPress={handleRunAllTests}
          disabled={batchTesting || loading}
        >
          {batchTesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="play-circle" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {t('testing.runAll')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>{t('testing.newTest')}</Text>
        <TextInput
          style={styles.inputField}
          multiline
          placeholder={t('testing.inputPlaceholder')}
          value={JSON.stringify(currentInput, null, 2)}
          onChangeText={text => {
            try {
              setCurrentInput(JSON.parse(text));
            } catch (e) {
              // Invalid JSON, ignore
            }
          }}
        />
        <View style={styles.inputActions}>
          <TouchableOpacity
            style={[styles.button, styles.runButton]}
            onPress={() => handleRunTest()}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{t('testing.run')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveTestCase}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{t('testing.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('testing.savedTests')}</Text>
      <ScrollView style={styles.testCaseList}>
        {testCases.map(renderTestCase)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  runAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  inputSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputField: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    height: 120,
    fontFamily: 'monospace',
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  runButton: {
    backgroundColor: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  testCaseList: {
    flex: 1,
    padding: 16,
  },
  testCase: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
    position: 'relative',
  },
  selectedTestCase: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  testCaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testCaseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  testCaseActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  testCaseContent: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#495057',
  },
  outputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  outputText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#495057',
  },
  errorText: {
    color: '#dc3545',
  },
  metrics: {
    flexDirection: 'row',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  statusIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    margin: 8,
  },
});

function getStatusStyle(status: TestCase['status']) {
  switch (status) {
    case 'running':
      return { backgroundColor: '#ffc107' };
    case 'success':
      return { backgroundColor: '#28a745' };
    case 'failure':
      return { backgroundColor: '#dc3545' };
    default:
      return { backgroundColor: '#6c757d' };
  }
}
