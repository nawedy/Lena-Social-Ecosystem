import React from 'react';
import { View } from 'react-native';
import { DatePicker } from './DatePicker';
import type { Meta, StoryObj } from '@storybook/react-native';

const meta: Meta<typeof DatePicker> = {
  title: 'components/DatePicker',
  component: DatePicker,
  argTypes: {
    onChange: { action: 'date changed' },
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

type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  args: {
    label: 'Date',
    placeholder: 'Select a date',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Date',
    value: new Date('2025-01-17'),
    placeholder: 'Select a date',
  },
};

export const WithError: Story = {
  args: {
    label: 'Date',
    error: 'Date is required',
    placeholder: 'Select a date',
  },
};

export const WithCustomFormat: Story = {
  args: {
    label: 'Date',
    value: new Date('2025-01-17'),
    format: 'DD/MM/YYYY',
    placeholder: 'Select a date',
  },
};

export const WithMinMaxDates: Story = {
  args: {
    label: 'Date',
    minimumDate: new Date('2025-01-01'),
    maximumDate: new Date('2025-12-31'),
    placeholder: 'Select a date in 2025',
  },
};

export const TimeMode: Story = {
  args: {
    label: 'Time',
    mode: 'time',
    placeholder: 'Select time',
  },
};

export const DateTimeMode: Story = {
  args: {
    label: 'Date & Time',
    mode: 'datetime',
    placeholder: 'Select date and time',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Date',
    value: new Date('2025-01-17'),
    disabled: true,
  },
};

export const Required: Story = {
  args: {
    label: 'Date',
    required: true,
    placeholder: 'Select a date',
  },
};

export const With24HourFormat: Story = {
  args: {
    label: 'Time',
    mode: 'time',
    is24Hour: true,
    placeholder: 'Select time',
  },
};
