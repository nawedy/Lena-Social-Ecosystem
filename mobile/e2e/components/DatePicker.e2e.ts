import { by, device, element, expect } from 'detox';

describe('DatePicker', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await element(by.id('datePickerTestScreen')).tap();
  });

  it('should show date picker when tapped', async () => {
    await element(by.id('datePicker')).tap();
    await expect(element(by.type('UIPickerView'))).toBeVisible();
  });

  it('should select a date', async () => {
    await element(by.id('datePicker')).tap();

    if (device.getPlatform() === 'ios') {
      await element(by.type('UIPickerView')).setDatePickerDate(
        '2025-01-17',
        'yyyy-MM-dd'
      );
      await element(by.text('Done')).tap();
    } else {
      // Android date picker interaction
      await element(by.type('android.widget.DatePicker')).setDatePickerDate(
        '2025-01-17',
        'yyyy-MM-dd'
      );
    }

    await expect(element(by.text('January 17, 2025'))).toBeVisible();
  });

  it('should show error when required and empty', async () => {
    await element(by.id('datePickerRequired')).tap();
    await element(by.id('submitButton')).tap();
    await expect(element(by.text('Date is required'))).toBeVisible();
  });

  it('should respect min date constraint', async () => {
    await element(by.id('datePickerWithMinDate')).tap();

    if (device.getPlatform() === 'ios') {
      await element(by.type('UIPickerView')).setDatePickerDate(
        '2024-12-31',
        'yyyy-MM-dd'
      );
      await element(by.text('Done')).tap();
      await expect(element(by.text('2025-01-01'))).toBeVisible();
    } else {
      // Android will prevent selecting dates before min date
      await expect(element(by.text('2024-12-31'))).not.toBeVisible();
    }
  });

  it('should handle time selection', async () => {
    await element(by.id('timePickerTest')).tap();

    if (device.getPlatform() === 'ios') {
      await element(by.type('UIPickerView')).setDatePickerDate(
        '14:30',
        'HH:mm'
      );
      await element(by.text('Done')).tap();
    } else {
      await element(by.type('android.widget.TimePicker')).setDatePickerDate(
        '14:30',
        'HH:mm'
      );
    }

    await expect(element(by.text('2:30 PM'))).toBeVisible();
  });

  it('should handle datetime selection', async () => {
    await element(by.id('dateTimePickerTest')).tap();

    if (device.getPlatform() === 'ios') {
      await element(by.type('UIPickerView')).setDatePickerDate(
        '2025-01-17T14:30:00',
        "yyyy-MM-dd'T'HH:mm:ss"
      );
      await element(by.text('Done')).tap();
    } else {
      await element(by.type('android.widget.DatePicker')).setDatePickerDate(
        '2025-01-17T14:30:00',
        "yyyy-MM-dd'T'HH:mm:ss"
      );
    }

    await expect(element(by.text('January 17, 2025 2:30 PM'))).toBeVisible();
  });

  it('should be disabled when disabled prop is true', async () => {
    await element(by.id('datePickerDisabled')).tap();
    await expect(element(by.type('UIPickerView'))).not.toBeVisible();
  });

  it('should clear selection when clear button is pressed', async () => {
    // First select a date
    await element(by.id('datePicker')).tap();
    if (device.getPlatform() === 'ios') {
      await element(by.type('UIPickerView')).setDatePickerDate(
        '2025-01-17',
        'yyyy-MM-dd'
      );
      await element(by.text('Done')).tap();
    } else {
      await element(by.type('android.widget.DatePicker')).setDatePickerDate(
        '2025-01-17',
        'yyyy-MM-dd'
      );
    }

    // Then clear it
    await element(by.id('datePickerClearButton')).tap();
    await expect(element(by.text('Select date'))).toBeVisible();
  });

  it('should format date according to format prop', async () => {
    await element(by.id('datePickerCustomFormat')).tap();

    if (device.getPlatform() === 'ios') {
      await element(by.type('UIPickerView')).setDatePickerDate(
        '2025-01-17',
        'yyyy-MM-dd'
      );
      await element(by.text('Done')).tap();
    } else {
      await element(by.type('android.widget.DatePicker')).setDatePickerDate(
        '2025-01-17',
        'yyyy-MM-dd'
      );
    }

    await expect(element(by.text('17/01/2025'))).toBeVisible();
  });
});
