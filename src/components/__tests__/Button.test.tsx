import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import Button from '../Button';

describe('Button', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders correctly with title', () => {
    const { getByText } = render(<Button title='Test Button' onPress={mockOnPress} />);

    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByText } = render(<Button title='Test Button' onPress={mockOnPress} />);

    fireEvent.press(getByText('Test Button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('applies custom style', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByTestId } = render(
      <Button title='Test Button' onPress={mockOnPress} style={customStyle} testID='button' />
    );

    const button = getByTestId('button');
    expect(button.props.style).toEqual(expect.arrayContaining([customStyle]));
  });

  it('disables the button when disabled prop is true', () => {
    const { getByTestId } = render(
      <Button title='Test Button' onPress={mockOnPress} disabled={true} testID='button' />
    );

    const button = getByTestId('button');
    expect(button.props.disabled).toBe(true);
  });
});
