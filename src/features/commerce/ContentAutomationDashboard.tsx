import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolContentAutomation,
  ContentTemplate,
  ContentSchedule,
  ContentAnalytics,
  ContentOptimization,
} from '../../services/atProtocolContentAutomation';

export const ContentAutomationDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [schedules, setSchedules] = useState<ContentSchedule[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, ContentAnalytics>>(
    {}
  );
  const [optimizations, setOptimizations] = useState<
    Record<string, ContentOptimization>
  >({});
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const _contentAutomation = new ATProtocolContentAutomation(agent);

  useEffect(() => {
    loadData();
  }, []);

  const _loadData = async () => {
    try {
      const [templatesData, schedulesData] = await Promise.all([
        // Get all content templates
        agent.api.app.bsky.commerce.listContentTemplates({}),
        // Get all content schedules
        agent.api.app.bsky.commerce.listContentSchedules({}),
      ]);

      setTemplates(templatesData.data.templates);
      setSchedules(schedulesData.data.schedules);

      // Load analytics and optimizations for each template
      const analyticsData: Record<string, ContentAnalytics> = {};
      const optimizationsData: Record<string, ContentOptimization> = {};

      await Promise.all(
        templatesData.data.templates.map(async template => {
          const [analytics, optimization] = await Promise.all([
            contentAutomation.getContentAnalytics({
              templateUri: template.uri,
              period: {
                start: format(
                  new Date().setDate(new Date().getDate() - 30),
                  'yyyy-MM-dd'
                ),
                end: format(new Date(), 'yyyy-MM-dd'),
              },
            }),
            contentAutomation.getContentOptimization(template.uri),
          ]);

          analyticsData[template.uri] = analytics;
          optimizationsData[template.uri] = optimization;
        })
      );

      setAnalytics(analyticsData);
      setOptimizations(optimizationsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading content automation data:', error);
      setLoading(false);
    }
  };

  const _createTemplate = async (params: {
    name: string;
    type: ContentTemplate['type'];
    template: string;
    variables: ContentTemplate['variables'];
  }) => {
    try {
      await contentAutomation.createTemplate(params);
      await loadData();
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const _createSchedule = async (params: {
    name: string;
    templateUri: string;
    frequency: ContentSchedule['frequency'];
    schedule: ContentSchedule['schedule'];
    variables: Record<string, any>;
  }) => {
    try {
      await contentAutomation.createSchedule({
        ...params,
        status: 'active',
      });
      await loadData();
    } catch (error) {
      console.error('Error creating schedule:', error);
    }
  };

  const _updateScheduleStatus = async (
    uri: string,
    status: ContentSchedule['status']
  ) => {
    try {
      await contentAutomation.updateScheduleStatus({ uri, status });
      await loadData();
    } catch (error) {
      console.error('Error updating schedule status:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">
          Loading content automation...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Search Bar */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <TextInput
          className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg"
          placeholder="Search templates and schedules..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
      </View>

      {/* Templates */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Content Templates
        </Text>
        {templates
          .filter(template =>
            template.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(template => (
            <TouchableOpacity
              key={template.uri}
              onPress={() =>
                setSelectedTemplate(
                  selectedTemplate === template.uri ? null : template.uri
                )
              }
              className="mb-4 border-b border-gray-200 pb-4"
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold dark:text-white">
                  {template.name}
                </Text>
                <Text className="text-blue-500">{template.type}</Text>
              </View>

              <Text className="text-gray-600 dark:text-gray-400 mt-1">
                Variables: {template.variables.length}
              </Text>

              {selectedTemplate === template.uri && (
                <View className="mt-4">
                  {/* Template Details */}
                  <View className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                    <Text className="font-semibold mb-2 dark:text-white">
                      Template Content
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                      {template.template}
                    </Text>

                    <Text className="font-semibold mt-4 mb-2 dark:text-white">
                      Variables
                    </Text>
                    {template.variables.map((variable, index) => (
                      <View key={index} className="mb-2">
                        <Text className="text-gray-600 dark:text-gray-400">
                          {variable.name} ({variable.type})
                          {variable.required && ' *'}
                        </Text>
                        {variable.defaultValue && (
                          <Text className="text-gray-500 dark:text-gray-400">
                            Default: {variable.defaultValue}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Analytics */}
                  {analytics[template.uri] && (
                    <View className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                      <Text className="font-semibold mb-2 dark:text-white">
                        Performance
                      </Text>
                      <View className="flex-row flex-wrap">
                        <View className="w-1/2 p-2">
                          <Text className="text-gray-600 dark:text-gray-400">
                            Impressions
                          </Text>
                          <Text className="text-2xl font-bold dark:text-white">
                            {analytics[
                              template.uri
                            ].metrics.impressions.toLocaleString()}
                          </Text>
                        </View>
                        <View className="w-1/2 p-2">
                          <Text className="text-gray-600 dark:text-gray-400">
                            Engagements
                          </Text>
                          <Text className="text-2xl font-bold dark:text-white">
                            {analytics[
                              template.uri
                            ].metrics.engagements.toLocaleString()}
                          </Text>
                        </View>
                        {analytics[template.uri].metrics.clicks !==
                          undefined && (
                          <View className="w-1/2 p-2">
                            <Text className="text-gray-600 dark:text-gray-400">
                              Clicks
                            </Text>
                            <Text className="text-2xl font-bold dark:text-white">
                              {analytics[
                                template.uri
                              ].metrics.clicks?.toLocaleString()}
                            </Text>
                          </View>
                        )}
                        {analytics[template.uri].metrics.conversions !==
                          undefined && (
                          <View className="w-1/2 p-2">
                            <Text className="text-gray-600 dark:text-gray-400">
                              Conversions
                            </Text>
                            <Text className="text-2xl font-bold dark:text-white">
                              {analytics[
                                template.uri
                              ].metrics.conversions?.toLocaleString()}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Performance Trends */}
                      <View className="mt-4">
                        <Text className="font-semibold mb-2 dark:text-white">
                          Performance Trends
                        </Text>
                        {analytics[template.uri].performance.trends.map(
                          (trend, index) => (
                            <Text
                              key={index}
                              className="text-gray-600 dark:text-gray-400"
                            >
                              {trend.metric}: {trend.change > 0 ? '+' : ''}
                              {(trend.change * 100).toFixed(1)}%
                              {trend.insight && ` - ${trend.insight}`}
                            </Text>
                          )
                        )}
                      </View>
                    </View>
                  )}

                  {/* Optimizations */}
                  {optimizations[template.uri] && (
                    <View className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                      <Text className="font-semibold mb-2 dark:text-white">
                        Recommendations
                      </Text>
                      {optimizations[template.uri].recommendations.map(
                        (rec, index) => (
                          <View key={index} className="mb-2">
                            <View className="flex-row justify-between">
                              <Text
                                className={`font-semibold ${
                                  rec.priority === 'high'
                                    ? 'text-red-500'
                                    : rec.priority === 'medium'
                                      ? 'text-yellow-500'
                                      : 'text-blue-500'
                                }`}
                              >
                                {rec.type.charAt(0).toUpperCase() +
                                  rec.type.slice(1)}
                              </Text>
                              <Text className="text-gray-500 dark:text-gray-400">
                                {(rec.expectedImpact * 100).toFixed(1)}% impact
                              </Text>
                            </View>
                            <Text className="text-gray-600 dark:text-gray-400">
                              {rec.suggestion}
                            </Text>
                          </View>
                        )
                      )}

                      {/* A/B Tests */}
                      {optimizations[template.uri].abTests.length > 0 && (
                        <View className="mt-4">
                          <Text className="font-semibold mb-2 dark:text-white">
                            A/B Test Results
                          </Text>
                          {optimizations[template.uri].abTests.map(
                            (test, index) => (
                              <View key={index} className="mb-2">
                                <Text className="text-gray-600 dark:text-gray-400">
                                  Variant {test.variant}:{' '}
                                  {(test.performance * 100).toFixed(1)}% (
                                  {test.sampleSize} samples,{' '}
                                  {(test.confidence * 100).toFixed(1)}%
                                  confidence)
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
      </View>

      {/* Schedules */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Content Schedules
        </Text>
        {schedules
          .filter(schedule =>
            schedule.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(schedule => (
            <View
              key={schedule.uri}
              className="mb-4 border-b border-gray-200 pb-4"
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold dark:text-white">
                  {schedule.name}
                </Text>
                <Text
                  className={`${
                    schedule.status === 'active'
                      ? 'text-green-500'
                      : schedule.status === 'paused'
                        ? 'text-yellow-500'
                        : schedule.status === 'error'
                          ? 'text-red-500'
                          : 'text-gray-500'
                  }`}
                >
                  {schedule.status}
                </Text>
              </View>

              <Text className="text-gray-600 dark:text-gray-400">
                Frequency: {schedule.frequency}
              </Text>
              {schedule.nextRun && (
                <Text className="text-gray-600 dark:text-gray-400">
                  Next Run:{' '}
                  {format(new Date(schedule.nextRun), 'MMM d, yyyy HH:mm')}
                </Text>
              )}

              {schedule.status === 'active' && (
                <TouchableOpacity
                  onPress={() => updateScheduleStatus(schedule.uri, 'paused')}
                  className="bg-yellow-500 rounded-lg p-2 mt-2"
                >
                  <Text className="text-white text-center">Pause Schedule</Text>
                </TouchableOpacity>
              )}

              {schedule.status === 'paused' && (
                <TouchableOpacity
                  onPress={() => updateScheduleStatus(schedule.uri, 'active')}
                  className="bg-green-500 rounded-lg p-2 mt-2"
                >
                  <Text className="text-white text-center">
                    Resume Schedule
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
      </View>

      {/* Create New Template Button */}
      <TouchableOpacity
        onPress={() => {
          // Open template creation modal/form
        }}
        className="bg-blue-500 m-4 p-4 rounded-lg"
      >
        <Text className="text-white text-center font-bold">
          Create New Template
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
