import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FeedScreen } from './features/feed/FeedScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { CreatePostScreen } from './features/content/CreatePostScreen';
import { NotificationsScreen } from './features/notifications/NotificationsScreen';
import { SearchScreen } from './features/search/SearchScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator>
          <Tab.Screen name="Feed" component={FeedScreen} />
          <Tab.Screen name="Search" component={SearchScreen} />
          <Tab.Screen name="Create" component={CreatePostScreen} />
          <Tab.Screen name="Notifications" component={NotificationsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
