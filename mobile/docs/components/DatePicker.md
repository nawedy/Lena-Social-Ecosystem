# DatePicker Component

A customizable and accessible date picker component for React Native applications.

## Features

- Multiple date selection modes (date, time, datetime)
- Custom date formatting
- Error handling and validation
- Accessibility support
- Platform-specific implementations (iOS modal, Android native picker)
- Customizable styling
- Min/max date constraints

## Installation

```bash
yarn add @react-native-community/datetimepicker dayjs
```

## Usage

```tsx
import { DatePicker } from '../components/shared/DatePicker';

const MyComponent = () => {
  const [date, setDate] = useState<Date>();

  return (
    <DatePicker
      label="Select Date"
      value={date}
      onChange={setDate}
      placeholder="Choose a date"
      required
    />
  );
};
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Label text for the date picker |
| `value` | `Date` | - | Selected date value |
| `onChange` | `(date: Date) => void` | - | Callback when date changes |
| `error` | `string` | - | Error message to display |
| `disabled` | `boolean` | `false` | Whether the date picker is disabled |
| `style` | `ViewStyle` | - | Custom styles for the container |
| `containerStyle` | `ViewStyle` | - | Custom styles for the outer container |
| `labelStyle` | `TextStyle` | - | Custom styles for the label |
| `placeholder` | `string` | `'Select date'` | Placeholder text |
| `format` | `string` | `'MMMM D, YYYY'` | Date format string (using dayjs) |
| `mode` | `'date'` \| `'time'` \| `'datetime'` | `'date'` | Picker mode |
| `minimumDate` | `Date` | - | Minimum selectable date |
| `maximumDate` | `Date` | - | Maximum selectable date |
| `required` | `boolean` | `false` | Whether the field is required |
| `minuteInterval` | `1` \| `2` \| `3` \| `4` \| `5` \| `6` \| `10` \| `12` \| `15` \| `20` \| `30` | `1` | Interval for minute selection |
| `is24Hour` | `boolean` | `false` | Use 24-hour format |
| `locale` | `string` | `'en'` | Locale for date formatting |

## Accessibility

The DatePicker component is fully accessible and includes:

- Proper role and state management
- Screen reader support
- Keyboard navigation
- Focus management
- Clear error announcements

## Examples

### Basic Usage

```tsx
<DatePicker
  label="Event Date"
  placeholder="Select event date"
  onChange={(date) => console.log('Selected date:', date)}
/>
```

### With Custom Format

```tsx
<DatePicker
  label="Appointment"
  format="DD/MM/YYYY"
  placeholder="Select appointment date"
  onChange={(date) => console.log('Selected date:', date)}
/>
```

### With Time Selection

```tsx
<DatePicker
  label="Meeting Time"
  mode="time"
  is24Hour
  minuteInterval={15}
  placeholder="Select meeting time"
  onChange={(date) => console.log('Selected time:', date)}
/>
```

### With Date Range Constraints

```tsx
<DatePicker
  label="Delivery Date"
  minimumDate={new Date()}
  maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
  placeholder="Select delivery date"
  onChange={(date) => console.log('Selected date:', date)}
/>
```

### With Validation

```tsx
<DatePicker
  label="Birth Date"
  required
  error={age < 18 ? 'Must be 18 or older' : undefined}
  placeholder="Select birth date"
  onChange={(date) => console.log('Selected date:', date)}
/>
```

## Performance Considerations

- Uses platform-specific implementations for optimal performance
- Implements proper memo-ization to prevent unnecessary re-renders
- Lazy loads the modal on iOS for better initial load time
- Uses proper cleanup in useEffect hooks

## Best Practices

1. Always provide meaningful labels and error messages
2. Use appropriate date formats for your locale
3. Consider time zones when handling dates
4. Implement proper validation for your use case
5. Test across different platforms and devices

## Related Components

- Form
- Input
- TimePicker
- Calendar
