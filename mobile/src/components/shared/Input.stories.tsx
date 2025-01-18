import React from 'react';
import { View } from 'react-native';
import { Input } from './Input';
import type { Meta, StoryObj } from '@storybook/react-native';

const meta: Meta<typeof Input> = {
  title: 'components/Input',
  component: Input,
  argTypes: {
    onChangeText: { action: 'text changed' },
    onBlur: { action: 'blurred' },
    onFocus: { action: 'focused' },
  },
  decorators: [
    Story => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Email',
    value: 'user@example.com',
    placeholder: 'Enter your email',
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    error: 'Password is required',
    placeholder: 'Enter your password',
    touched: true,
  },
};

export const WithHelper: Story = {
  args: {
    label: 'Password',
    helper: 'Must be at least 8 characters',
    placeholder: 'Enter your password',
    secureTextEntry: true,
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search...',
    leftIcon: 'search',
    rightIcon: 'close',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    value: 'johndoe',
    editable: false,
  },
};

export const Loading: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    loading: true,
  },
};

export const Success: Story = {
  args: {
    label: 'Email',
    value: 'user@example.com',
    success: true,
  },
};

export const Required: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
    required: true,
  },
};

export const WithMultiline: Story = {
  args: {
    label: 'Bio',
    placeholder: 'Tell us about yourself',
    multiline: true,
    numberOfLines: 4,
  },
};
