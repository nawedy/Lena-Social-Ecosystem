tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';

import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { CreatePostScreen } from './src/screens/CreatePostScreen';
import { store } from './src/store';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from './src/store/slices/auth';


const Stack = createNativeStackNavigator();

const App: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
 
  return (
    
   
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={isAuthenticated ? "Home" : "Auth"}>
           {isAuthenticated ? (
            <Stack.Screen name="Home" component={HomeScreen} />
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
           <Stack.Screen name="Profile" component={ProfileScreen} />
           <Stack.Screen name="CreatePost" component={CreatePostScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

export default App;