import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

export type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Post: { postId: string };
  Settings: undefined;
  Auth: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  Search: undefined;
  CreatePost: undefined;
  Comments: { postId: string };
  UserList: { type: 'followers' | 'following'; userId: string };
  Chat: { chatId: string };
  Messages: undefined;
};

export type BottomTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  CreateTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Post: { postId: string };
  Settings: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  Search: undefined;
  CreatePost: undefined;
  Comments: { postId: string };
  UserList: { type: 'followers' | 'following'; userId: string };
  Chat: { chatId: string };
  Messages: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const BottomTab = createBottomTabNavigator<BottomTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

export const Navigation = () => {
  return (
    <NavigationContainer>
      <RootStack.Navigator>
        <RootStack.Screen name='Auth' component={AuthNavigator} />
        <RootStack.Screen name='Main' component={MainNavigator} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const AuthNavigator = () => {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name='SignIn' component={SignInScreen} />
      <AuthStack.Screen name='SignUp' component={SignUpScreen} />
      <AuthStack.Screen name='ForgotPassword' component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <MainStack.Navigator>
      <MainStack.Screen name='Tabs' component={TabNavigator} />
      <MainStack.Screen name='Profile' component={ProfileScreen} />
      <MainStack.Screen name='Post' component={PostScreen} />
      <MainStack.Screen name='Settings' component={SettingsScreen} />
      <MainStack.Screen name='EditProfile' component={EditProfileScreen} />
      <MainStack.Screen name='Comments' component={CommentsScreen} />
      <MainStack.Screen name='UserList' component={UserListScreen} />
      <MainStack.Screen name='Chat' component={ChatScreen} />
      <MainStack.Screen name='Messages' component={MessagesScreen} />
    </MainStack.Navigator>
  );
};

const TabNavigator = () => {
  return (
    <BottomTab.Navigator>
      <BottomTab.Screen name='HomeTab' component={HomeScreen} />
      <BottomTab.Screen name='SearchTab' component={SearchScreen} />
      <BottomTab.Screen name='CreateTab' component={CreatePostScreen} />
      <BottomTab.Screen name='NotificationsTab' component={NotificationsScreen} />
      <BottomTab.Screen name='ProfileTab' component={ProfileScreen} />
    </BottomTab.Navigator>
  );
};

// Placeholder components - these should be replaced with actual screen components
const SignInScreen = () => null;
const SignUpScreen = () => null;
const ForgotPasswordScreen = () => null;
const HomeScreen = () => null;
const SearchScreen = () => null;
const CreatePostScreen = () => null;
const NotificationsScreen = () => null;
const ProfileScreen = () => null;
const PostScreen = () => null;
const SettingsScreen = () => null;
const EditProfileScreen = () => null;
const CommentsScreen = () => null;
const UserListScreen = () => null;
const ChatScreen = () => null;
const MessagesScreen = () => null;
