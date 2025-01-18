import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';

import { Dropdown } from './Dropdown';

const meta: Meta<typeof Dropdown> = {
  title: 'components/Dropdown',
  component: Dropdown,
  argTypes: {
    onChange: { action: 'value changed' },
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

type Story = StoryObj<typeof Dropdown>;

const defaultItems = [
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
  { label: 'Option 3', value: '3' },
  { label: 'Option 4', value: '4' },
  { label: 'Option 5', value: '5' },
];

const itemsWithIcons = [
  { label: 'Home', value: 'home', icon: 'home' },
  { label: 'Settings', value: 'settings', icon: 'settings' },
  { label: 'Profile', value: 'profile', icon: 'person' },
  { label: 'Messages', value: 'messages', icon: 'mail' },
  { label: 'Notifications', value: 'notifications', icon: 'notifications' },
];

export const Default: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    placeholder: 'Choose an option',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    value: '2',
    placeholder: 'Choose an option',
  },
};

export const WithError: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    error: 'Please select an option',
    placeholder: 'Choose an option',
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Select Option',
    items: itemsWithIcons,
    placeholder: 'Choose an option',
  },
};

export const WithSearch: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    searchable: true,
    placeholder: 'Choose an option',
  },
};

export const MultipleSelection: Story = {
  args: {
    label: 'Select Options',
    items: defaultItems,
    multiple: true,
    placeholder: 'Choose options',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    disabled: true,
    placeholder: 'Choose an option',
  },
};

export const Loading: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    loading: true,
    placeholder: 'Loading options...',
  },
};

export const Required: Story = {
  args: {
    label: 'Select Option',
    items: defaultItems,
    required: true,
    placeholder: 'Choose an option',
  },
};

export const WithDisabledItems: Story = {
  args: {
    label: 'Select Option',
    items: [
      ...defaultItems,
      { label: 'Disabled Option', value: 'disabled', disabled: true },
    ],
    placeholder: 'Choose an option',
  },
};
