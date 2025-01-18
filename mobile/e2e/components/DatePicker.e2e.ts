import { By, device, element, expect } from 'detox';

describe('DatePicker', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await element(By.id('datePickerTestScreen')).tap();
  });

  it('should show date picker when tapped', async () => {
    await element(By.id('datePicker')).tap();
    await expect(element(By.type('UIPickerView'))).toBeVisible();
  });

  it('should select a date', async () => {
    await element(By.id('datePicker')).tap();

    if (device.getPlatform() === 'ios') {
      await element(By.type('UIPickerView')).setDate('2025-01-17');
      await element(By.text('Done')).tap();
    } else {
      await element(By.type('android.widget.DatePicker')).setDate('2025-01-17');
    }

    await expect(element(By.text('January 17, 2025'))).toBeVisible();
  });

  it('should show error when required and empty', async () => {
    await element(By.id('datePickerRequired')).tap();
    await element(By.id('submitButton')).tap();
    await expect(element(By.text('Date is required'))).toBeVisible();
  });

  it('should respect min date constraint', async () => {
    await element(By.id('datePickerWithMinDate')).tap();

    if (device.getPlatform() === 'ios') {
      await element(By.type('UIPickerView')).setDate('2025-01-01');
      await element(By.text('Done')).tap();
      await expect(element(By.text('2025-01-01'))).toBeVisible();
    } else {
      // Android will prevent selecting dates before min date
      await expect(element(By.text('2024-12-31'))).not.toBeVisible();
    }
  });

  it('should handle time selection', async () => {
    await element(By.id('timePickerTest')).tap();

    if (device.getPlatform() === 'ios') {
      await element(By.type('UIPickerView')).setTime('14:30');
      await element(By.text('Done')).tap();
    } else {
      await element(By.type('android.widget.TimePicker')).setTime('14:30');
    }

    await expect(element(By.text('2:30 PM'))).toBeVisible();
  });

  it('should handle datetime selection', async () => {
    await element(By.id('dateTimePickerTest')).tap();

    if (device.getPlatform() === 'ios') {
      await element(By.type('UIPickerView')).setDateTime('2025-01-17T14:30:00');
      await element(By.text('Done')).tap();
    } else {
      await element(By.type('android.widget.DateTimePicker')).setDateTime('2025-01-17T14:30:00');
    }

    await expect(element(By.text('January 17, 2025 2:30 PM'))).toBeVisible();
  });

  it('should be disabled when disabled prop is true', async () => {
    await element(By.id('datePickerDisabled')).tap();
    await expect(element(By.type('UIPickerView'))).not.toBeVisible();
  });

  it('should clear selection when clear button is pressed', async () => {
    // First select a date
    await element(By.id('datePicker')).tap();
    if (device.getPlatform() === 'ios') {
      await element(By.type('UIPickerView')).setDate('2025-01-17');
      await element(By.text('Done')).tap();
    } else {
      await element(By.type('android.widget.DatePicker')).setDate('2025-01-17');
    }

    // Then clear it
    await element(By.id('datePickerClearButton')).tap();
    await expect(element(By.text('Select date'))).toBeVisible();
  });

  it('should format date according to format prop', async () => {
    await element(By.id('datePickerCustomFormat')).tap();

    if (device.getPlatform() === 'ios') {
      await element(By.type('UIPickerView')).setDate('2025-01-17');
      await element(By.text('Done')).tap();
    } else {
      await element(By.type('android.widget.DatePicker')).setDate('2025-01-17');
    }

    await expect(element(By.text('17/01/2025'))).toBeVisible();
  });
});
