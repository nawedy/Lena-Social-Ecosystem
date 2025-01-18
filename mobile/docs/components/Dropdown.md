# Dropdown Component

A flexible and accessible dropdown component for React Native applications with search functionality and multiple selection support.

## Features

- Single and multiple selection modes
- Search functionality
- Custom item rendering
- Icon support
- Loading state
- Error handling
- Accessibility support
- Customizable styling
- Virtual scrolling for large lists

## Installation

```bash
yarn add react-native-vector-icons
```

## Usage

```tsx
import { Dropdown } from '../components/shared/Dropdown';

const MyComponent = () => {
  const [value, setValue] = useState<string>();

  const items = [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
  ];

  return (
    <Dropdown
      label="Select Option"
      items={items}
      value={value}
      onChange={setValue}
      placeholder="Choose an option"
    />
  );
};
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Label text for the dropdown |
| `items` | `Array<DropdownItem>` | `[]` | Array of items to display |
| `value` | `string` \| `string[]` | - | Selected value(s) |
| `onChange` | `(value: string \| string[]) => void` | - | Callback when selection changes |
| `error` | `string` | - | Error message to display |
| `disabled` | `boolean` | `false` | Whether the dropdown is disabled |
| `style` | `ViewStyle` | - | Custom styles for the container |
| `placeholder` | `string` | `'Select'` | Placeholder text |
| `searchable` | `boolean` | `false` | Enable search functionality |
| `multiple` | `boolean` | `false` | Enable multiple selection |
| `loading` | `boolean` | `false` | Show loading state |
| `required` | `boolean` | `false` | Whether the field is required |
| `searchPlaceholder` | `string` | `'Search...'` | Search input placeholder |
| `renderItem` | `(item: DropdownItem) => ReactNode` | - | Custom item renderer |
| `itemHeight` | `number` | `48` | Height of each item for virtual scrolling |
| `maxHeight` | `number` | `300` | Maximum height of the dropdown list |
| `onSearch` | `(query: string) => void` | - | Callback when search query changes |
| `clearable` | `boolean` | `true` | Allow clearing the selection |

## Types

```typescript
interface DropdownItem {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
}
```

## Accessibility

The Dropdown component implements full accessibility support:

- ARIA roles and states
- Keyboard navigation
- Screen reader announcements
- Focus management
- Clear error and selection announcements

## Examples

### Basic Usage

```tsx
<Dropdown
  label="Country"
  items={[
    { label: 'United States', value: 'us' },
    { label: 'Canada', value: 'ca' },
    { label: 'United Kingdom', value: 'uk' },
  ]}
  onChange={(value) => console.log('Selected:', value)}
/>
```

### With Search

```tsx
<Dropdown
  label="City"
  searchable
  items={cities}
  placeholder="Select a city"
  searchPlaceholder="Search cities..."
  onChange={(value) => console.log('Selected city:', value)}
/>
```

### Multiple Selection

```tsx
<Dropdown
  label="Skills"
  multiple
  items={skills}
  placeholder="Select skills"
  onChange={(values) => console.log('Selected skills:', values)}
/>
```

### With Icons

```tsx
<Dropdown
  label="Menu"
  items={[
    { label: 'Home', value: 'home', icon: 'home' },
    { label: 'Settings', value: 'settings', icon: 'settings' },
    { label: 'Profile', value: 'profile', icon: 'person' },
  ]}
  onChange={(value) => console.log('Selected:', value)}
/>
```

### With Custom Rendering

```tsx
<Dropdown
  label="Users"
  items={users}
  renderItem={(item) => (
    <View style={styles.userItem}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <Text>{item.label}</Text>
    </View>
  )}
  onChange={(value) => console.log('Selected user:', value)}
/>
```

## Performance Considerations

1. Virtual scrolling for large lists
2. Debounced search
3. Memoized item rendering
4. Efficient state updates
5. Proper cleanup of event listeners

## Best Practices

1. Provide clear labels and placeholders
2. Use appropriate icons that are easily recognizable
3. Implement proper error handling
4. Consider keyboard accessibility
5. Test with large datasets
6. Implement proper loading states
7. Use appropriate max height based on context

## Related Components

- Select
- MultiSelect
- Autocomplete
- ComboBox
- Form
- Input
