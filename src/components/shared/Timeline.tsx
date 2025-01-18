import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';

interface TimelineItem {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export const Timeline: React.FC<TimelineProps> = ({ items }) => {
  return (
    <View className="relative">
      {items.map((item, index) => (
        <View key={index} className="flex-row mb-4">
          {/* Timeline Line */}
          <View className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {/* Timeline Dot */}
          <View className="relative">
            <View className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center z-10" />
          </View>

          {/* Content */}
          <View className="flex-1 ml-4">
            <Text className="font-semibold dark:text-white">
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
            <Text className="text-gray-600 dark:text-gray-400">
              {item.description}
            </Text>
            {item.location && (
              <Text className="text-gray-600 dark:text-gray-400">
                Location: {item.location}
              </Text>
            )}
            <Text className="text-gray-500 text-sm">
              {format(new Date(item.timestamp), 'MMM d, yyyy h:mm a')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};
