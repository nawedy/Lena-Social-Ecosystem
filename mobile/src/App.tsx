import messaging from '@react-native-firebase/messaging';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { StatusBar, LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PushNotification from 'react-native-push-notification';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { logger } from '../../src/utils/logger';

import { RootNavigator } from './navigation';
import { initializeServices } from './services';
import { store, persistor } from './store';
import { ThemeProvider } from './theme';

LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

const App = () => {
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize services
        await initializeServices();

        // Configure push notifications
        await configurePushNotifications();

        // Hide splash screen
        SplashScreen.hide();
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    initialize();
  }, []);

  const configurePushNotifications = async () => {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        logger.info('Authorization status:', authStatus);
      }
    }

    PushNotification.configure({
      onRegister: function (token) {
        logger.info('TOKEN:', token);
      },
      onNotification: function (notification) {
        logger.info('NOTIFICATION:', notification);
      },
      onAction: function (notification) {
        logger.info('ACTION:', notification.action);
        logger.info('NOTIFICATION:', notification);
      },
      onRegistrationError: function (err) {
        console.error(err.message, err);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });

    messaging().setBackgroundMessageHandler(async remoteMessage => {
      logger.info('Message handled in the background!', remoteMessage);
    });
  };

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <NavigationContainer>
                <StatusBar
                  barStyle="dark-content"
                  backgroundColor="transparent"
                  translucent
                />
                <RootNavigator />
              </NavigationContainer>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;
