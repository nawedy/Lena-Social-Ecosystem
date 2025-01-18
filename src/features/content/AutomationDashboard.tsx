import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolAutomatedContent,
  ContentAutomation,
  AutomatedPost,
} from '../../services/atProtocolAutomatedContent';
import { format } from 'date-fns';

export const AutomationDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [automations, setAutomations] = useState<ContentAutomation[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<AutomatedPost[]>([]);
  const [trends, setTrends] = useState<
    Array<{
      topic: string;
      score: number;
      suggestedContent: Array<{
        type: string;
        content: string;
        estimatedPerformance: number;
      }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const _automatedContent = new ATProtocolAutomatedContent(agent);

  useEffect(() => {
    loadData();
  }, []);

  const _loadData = async () => {
    try {
      const [automationsData, postsData, trendsData] = await Promise.all([
        // Get active automations
        automatedContent.getAutomations(),
        // Get scheduled posts
        automatedContent.getScheduledPosts(),
        // Monitor trends
        automatedContent.monitorTrends({
          categories: ['product', 'lifestyle', 'tech'],
          threshold: 0.5,
        }),
      ]);

      setAutomations(automationsData);
      setScheduledPosts(postsData);
      setTrends(trendsData);
    } catch (error) {
      console.error('Error loading automation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const _createAutomation = async () => {
    try {
      const _newAutomation = await automatedContent.createAutomation({
        name: 'Product Promotion',
        triggers: [
          {
            type: 'schedule',
            conditions: {
              schedule: {
                frequency: 'daily',
                time: '10:00',
              },
            },
          },
        ],
        contentTemplate: {
          type: 'post',
          template:
            '🔥 Check out our latest {{product}}! 🛍️\n\n{{description}}\n\nShop now: {{link}}\n\n#{{category}} #shopping',
          variables: ['product', 'description', 'link', 'category'],
          hashtags: ['shopping', 'deals'],
          mentions: [],
        },
        targeting: {
          audience: ['shoppers', 'tech-enthusiasts'],
          products: ['electronics', 'accessories'],
        },
      });

      setAutomations([...automations, newAutomation]);
    } catch (error) {
      console.error('Error creating automation:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">
          Loading automation dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Active Automations */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Active Automations
        </Text>
        {automations.map(automation => (
          <View
            key={automation.uri}
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">
                {automation.name}
              </Text>
              <Text
                className={`${
                  automation.status === 'active'
                    ? 'text-green-500'
                    : automation.status === 'paused'
                      ? 'text-yellow-500'
                      : 'text-gray-500'
                }`}
              >
                {automation.status.charAt(0).toUpperCase() +
                  automation.status.slice(1)}
              </Text>
            </View>
            <Text className="text-gray-600 dark:text-gray-400 mt-1">
              Posts: {automation.performance.posts} | Engagement:{' '}
              {automation.performance.engagement}
            </Text>
            <Text className="text-gray-600 dark:text-gray-400">
              Revenue: ${automation.performance.revenue.toLocaleString()}
            </Text>
          </View>
        ))}
        <TouchableOpacity
          className="bg-blue-500 rounded-lg p-3 mt-2"
          onPress={createAutomation}
        >
          <Text className="text-white text-center font-semibold">
            Create New Automation
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scheduled Posts */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Scheduled Posts
        </Text>
        {scheduledPosts.map(post => (
          <View key={post.uri} className="mb-4 border-b border-gray-200 pb-4">
            <Text className="font-semibold dark:text-white">
              {format(new Date(post.scheduledFor), 'MMM d, yyyy h:mm a')}
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 mt-1">
              {post.content.text.length > 100
                ? post.content.text.substring(0, 100) + '...'
                : post.content.text}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-600 dark:text-gray-400">
                {post.content.media
                  ? `${post.content.media.length} media items`
                  : 'No media'}
              </Text>
              <Text
                className={`${
                  post.status === 'scheduled'
                    ? 'text-blue-500'
                    : post.status === 'published'
                      ? 'text-green-500'
                      : 'text-red-500'
                }`}
              >
                {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Trending Topics */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Trending Topics
        </Text>
        {trends.map(trend => (
          <View
            key={trend.topic}
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">
                {trend.topic}
              </Text>
              <Text className="text-blue-500">
                Score: {trend.score.toFixed(2)}
              </Text>
            </View>
            <Text className="text-gray-600 dark:text-gray-400 mt-2 font-semibold">
              Suggested Content:
            </Text>
            {trend.suggestedContent.map((suggestion, index) => (
              <View key={index} className="mt-2">
                <Text className="text-gray-600 dark:text-gray-400">
                  {suggestion.type}:{' '}
                  {suggestion.content.length > 100
                    ? suggestion.content.substring(0, 100) + '...'
                    : suggestion.content}
                </Text>
                <Text className="text-green-500">
                  Est. Performance:{' '}
                  {(suggestion.estimatedPerformance * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View className="flex-row flex-wrap p-4">
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to automation creator */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Create Automation</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to content scheduler */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Schedule Content</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to trend analysis */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Analyze Trends</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to performance metrics */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">View Metrics</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
