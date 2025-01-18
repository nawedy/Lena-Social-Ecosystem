import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';

import { HomeScreen } from '../screens/Home';
import { ExploreScreen } from '../screens/Explore';
import { NotificationsScreen } from '../screens/Notifications';
import { ProfileScreen } from '../screens/Profile';
import { AuthScreen } from '../screens/Auth';
import { ComposeScreen } from '../screens/Compose';
import { SettingsScreen } from '../screens/Settings';
import { ChatScreen } from '../screens/Chat';
import { TabBar } from '../components/TabBar';
import { selectIsAuthenticated } from '../store/slices/auth';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator
    tabBar={props => <TabBar {...props} />}
    screenOptions={{
      headerShown: false,
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarLabel: 'Home',
      }}
    />
    <Tab.Screen
      name="Explore"
      component={ExploreScreen}
      options={{
        tabBarLabel: 'Explore',
      }}
    />
    <Tab.Screen
      name="Compose"
      component={ComposeScreen}
      options={{
        tabBarLabel: 'Post',
      }}
    />
    <Tab.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{
        tabBarLabel: 'Notifications',
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
      }}
    />
  </Tab.Navigator>
);

export const RootNavigator = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
};
