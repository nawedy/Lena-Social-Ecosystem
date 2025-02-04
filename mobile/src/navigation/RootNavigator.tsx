import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useSelector } from 'react-redux'; // Import useSelector from react-redux

import { AuthScreen } from '../screens/Auth'; // Import AuthScreen
import { TabBar } from '../components/TabBar';
import { ChatScreen } from '../screens/Chat';
import { ExploreScreen } from '../screens/Explore';
import { NotificationsScreen } from '../screens/Notifications';
import { SettingsScreen } from '../screens/Settings';
import { selectIsAuthenticated } from '../store/slices/auth';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
import HomeScreen from "../screens/HomeScreen";
import ComposeScreen from "../screens/ComposeScreen";
import { ProfileScreen } from '../screens/Profile';


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
