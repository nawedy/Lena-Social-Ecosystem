import React from 'react';

import { useAuth } from '../../contexts/AuthContext';

const Home: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
        Welcome to TikTokToe
      </h1>

      {currentUser ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feed content will go here */}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Join our community to share and discover amazing content
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;
