import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Test Button" onPress={() => {}} />);
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Test Button" onPress={onPress} />);
    
    fireEvent.press(getByText('Test Button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies custom styles', () => {
    const { getByTestId } = render(
      <Button
        title="Test Button"
        onPress={() => {}}
        style={{ backgroundColor: 'red' }}
        testID="custom-button"
      />
    );
    
    const button = getByTestId('custom-button');
    expect(button.props.style).toMatchObject({
      backgroundColor: 'red',
    });
  });
});
