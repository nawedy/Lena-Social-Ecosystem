export const linking = {
  prefixes: ['tiktotoe://', 'https://tiktotoe.app'],

  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          Home: {
            path: 'home',
            screens: {
              Feed: '',
              Search: 'search',
            },
          },
          Explore: {
            path: 'explore',
            screens: {
              Trending: 'trending',
              Featured: 'featured',
              Categories: 'categories/:id',
            },
          },
          Compose: 'compose',
          Notifications: {
            path: 'notifications',
            screens: {
              All: '',
              Mentions: 'mentions',
              Likes: 'likes',
              Reposts: 'reposts',
            },
          },
          Profile: {
            path: 'profile/:did',
            screens: {
              Posts: '',
              Media: 'media',
              Likes: 'likes',
            },
          },
        },
      },
      PostDetail: 'post/:id',
      Settings: 'settings',
      Chat: 'chat/:id',
      NotFound: '*',
    },
  },

  // Custom function to get the initial route name
  getInitialRouteName: (path: string) => {
    // Add custom logic here if needed
    return 'Home';
  },
};
