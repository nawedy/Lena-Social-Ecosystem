import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { DatePicker } from '../components/shared/DatePicker';
import { Dropdown } from '../components/shared/Dropdown';
import { Button } from '../components/shared/Button';
import { SafeAreaView } from 'react-native-safe-area-context';

const dropdownItems = [
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
  { label: 'Option 3', value: '3' },
  { label: 'Option 4', value: '4' },
  { label: 'Option 5', value: '5' },
];

const dropdownItemsWithIcons = [
  { label: 'Home', value: 'home', icon: 'home' },
  { label: 'Settings', value: 'settings', icon: 'settings' },
  { label: 'Profile', value: 'profile', icon: 'person' },
];

const longDropdownItems = Array.from({ length: 50 }, (_, i) => ({
  label: `Option ${i + 1}`,
  value: `${i + 1}`,
}));

export const TestScreen: React.FC = () => {
  const [date, setDate] = useState<Date>();
  const [dropdownValue, setDropdownValue] = useState<string>();
  const [multiDropdownValue, setMultiDropdownValue] = useState<string[]>([]);
  const [searchDropdownValue, setSearchDropdownValue] = useState<string>();
  const [hasError, setHasError] = useState(false);

  const handleSubmit = () => {
    setHasError(!date || !dropdownValue);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView testID="testScreen" contentContainerStyle={styles.content}>
        <Text style={styles.title}>Component Testing</Text>

        {/* Date Picker Tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Picker Tests</Text>

          <DatePicker
            testID="datePicker"
            label="Default Date Picker"
            value={date}
            onChange={setDate}
          />

          <DatePicker
            testID="datePickerRequired"
            label="Required Date Picker"
            value={date}
            onChange={setDate}
            required
            error={hasError && !date ? 'Date is required' : undefined}
          />

          <DatePicker
            testID="datePickerWithMinDate"
            label="Date Picker with Min Date"
            value={date}
            onChange={setDate}
            minimumDate={new Date('2025-01-01')}
          />

          <DatePicker
            testID="timePickerTest"
            label="Time Picker"
            mode="time"
            value={date}
            onChange={setDate}
          />

          <DatePicker
            testID="dateTimePickerTest"
            label="Date Time Picker"
            mode="datetime"
            value={date}
            onChange={setDate}
          />

          <DatePicker
            testID="datePickerDisabled"
            label="Disabled Date Picker"
            value={date}
            onChange={setDate}
            disabled
          />

          <DatePicker
            testID="datePickerCustomFormat"
            label="Custom Format Date Picker"
            value={date}
            onChange={setDate}
            format="DD/MM/YYYY"
          />
        </View>

        {/* Dropdown Tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dropdown Tests</Text>

          <Dropdown
            testID="dropdown"
            label="Default Dropdown"
            items={dropdownItems}
            value={dropdownValue}
            onChange={setDropdownValue}
          />

          <Dropdown
            testID="multipleDropdown"
            label="Multiple Selection Dropdown"
            items={dropdownItems}
            value={multiDropdownValue}
            onChange={setMultiDropdownValue}
            multiple
          />

          <Dropdown
            testID="searchableDropdown"
            label="Searchable Dropdown"
            items={dropdownItems}
            value={searchDropdownValue}
            onChange={setSearchDropdownValue}
            searchable
          />

          <Dropdown
            testID="requiredDropdown"
            label="Required Dropdown"
            items={dropdownItems}
            value={dropdownValue}
            onChange={setDropdownValue}
            required
            error={
              hasError && !dropdownValue ? 'Selection required' : undefined
            }
          />

          <Dropdown
            testID="disabledDropdown"
            label="Disabled Dropdown"
            items={dropdownItems}
            value={dropdownValue}
            onChange={setDropdownValue}
            disabled
          />

          <Dropdown
            testID="loadingDropdown"
            label="Loading Dropdown"
            items={dropdownItems}
            value={dropdownValue}
            onChange={setDropdownValue}
            loading
          />

          <Dropdown
            testID="dropdownWithDisabledItems"
            label="Dropdown with Disabled Items"
            items={[
              ...dropdownItems,
              { label: 'Disabled Option', value: 'disabled', disabled: true },
            ]}
            value={dropdownValue}
            onChange={setDropdownValue}
          />

          <Dropdown
            testID="dropdownWithIcons"
            label="Dropdown with Icons"
            items={dropdownItemsWithIcons}
            value={dropdownValue}
            onChange={setDropdownValue}
          />

          <Dropdown
            testID="dropdownWithLongList"
            label="Dropdown with Long List"
            items={longDropdownItems}
            value={dropdownValue}
            onChange={setDropdownValue}
          />
        </View>

        <Button
          testID="submitButton"
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          Submit
        </Button>

        <View testID="outsideArea" style={styles.outsideArea} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 16,
  },
  outsideArea: {
    height: 100,
    marginTop: 16,
  },
});
