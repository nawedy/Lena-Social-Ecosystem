import React from 'react';
import { Platform } from 'react-native';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NativeRouter } from 'react-router-native';

import Navbar from './components/layout/Navbar';
import CreatePost from './components/pages/CreatePost';
import Home from './components/pages/Home';
import Notifications from './components/pages/Notifications';
import Profile from './components/pages/Profile';
import Search from './components/pages/Search';
import Settings from './components/pages/Settings';
import { ATProtoProvider } from './contexts/ATProtoContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Use appropriate router based on platform
const Router = Platform.select({
  web: BrowserRouter,
  default: NativeRouter,
});

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
                <Route path="/settings" element={<Settings />} />
                <Route path="/create" element={<CreatePost />} />
                <Route path="/notifications" element={<Notifications />} />
              </Routes>
            </div>
          </Router>
        </ATProtoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
