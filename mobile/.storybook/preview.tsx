import { withBackgrounds } from '@storybook/addon-ondevice-backgrounds';
import type { Preview } from '@storybook/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../src/theme';

const preview: Preview = {
  decorators: [
    withBackgrounds,
    Story => (
      <SafeAreaProvider>
        <ThemeProvider>
          <Story />
        </ThemeProvider>
      </SafeAreaProvider>
    ),
  ],
  parameters: {
    backgrounds: [
      { name: 'light', value: '#FFFFFF' },
      { name: 'dark', value: '#000000' },
    ],
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
