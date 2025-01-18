import React from 'react';
import { Platform } from 'react-native';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NativeRouter } from 'react-router-native';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import Home from './components/pages/Home';
import Login from './components/pages/Login';
import Register from './components/pages/Register';
import Search from './components/pages/Search';
import CreatePost from './components/pages/CreatePost';
import Notifications from './components/pages/Notifications';
import PrivateRoute from './components/auth/PrivateRoute';
import Profile from './components/pages/Profile';

const _Router = Platform.select({
  web: BrowserRouter,
  default: NativeRouter,
});

interface SearchScreenProps {
  navigation: any;
}

interface CreatePostScreenProps {
  navigation: any;
}

interface NotificationsScreenProps {
  navigation: any;
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="app">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <PrivateRoute>
                    <Search navigation={{}} />
                  </PrivateRoute>
                }
              />
              <Route
                path="/create"
                element={
                  <PrivateRoute>
                    <CreatePost navigation={{}} />
                  </PrivateRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <PrivateRoute>
                    <Notifications navigation={{}} />
                  </PrivateRoute>
                }
              />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
