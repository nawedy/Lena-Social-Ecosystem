import React from 'react';
import { Platform, View, Text, StyleProp, ViewStyle } from 'react-native';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NativeRouter } from 'react-router-native';

import Navbar from './components/layout/Navbar';
import CreatePost from './components/pages/CreatePost';
import Home from './components/pages/Home';
import Notifications from './components/pages/Notifications';
import Profile from './components/pages/Profile';
import Search from './components/pages/Search';
// import Settings from './components/pages/Settings';
import { ATProtoProvider } from './contexts/ATProtoContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';


const UnsupportedPlatform: React.FC = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' } as StyleProp<ViewStyle>}>
    <div>
        <h1>Unsupported Platform</h1>
        <p>This platform is not supported.</p>
      </div>
    </View>
  );
};

const NotFound: React.FC = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>404: Page Not Found</Text>
    </View>
  )
}

const Router = (
  Platform.select({
    web: BrowserRouter,
    android: NativeRouter,
    ios: NativeRouter,
    default: () => UnsupportedPlatform,
  })! as React.ComponentType<{ children?: React.ReactNode; }>;

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ATProtoProvider>
          <Router>
           <div className="app">
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/profile/:userId" element={<Profile />} />
                {/* <Route path="/settings" element={<Settings />} /> */}
                <Route path="/create" element={<CreatePost />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
             </div>
          </Router>
        </ATProtoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
