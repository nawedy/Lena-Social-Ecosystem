import { device, element, by, expect } from 'detox';

describe('DatePicker Component', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show date picker when tapping input field', async () => {
    await element(by.id('date-picker-input')).tap();
    await expect(element(by.id('date-picker-modal'))).toBeVisible();
  });

  it('should select a date and update the input field', async () => {
    await element(by.id('date-picker-input')).tap();
    await element(by.text('15')).tap();
    await element(by.id('confirm-date-button')).tap();
    await expect(element(by.id('date-picker-input'))).toHaveText(expect.stringMatching(/\d{2}\/\d{2}\/\d{4}/));
  });

  it('should cancel date selection', async () => {
    const initialDate = await element(by.id('date-picker-input')).getAttributes();
    await element(by.id('date-picker-input')).tap();
    await element(by.text('20')).tap();
    await element(by.id('cancel-date-button')).tap();
    const finalDate = await element(by.id('date-picker-input')).getAttributes();
    await expect(finalDate.text).toBe(initialDate.text);
  });

  it('should handle min and max date constraints', async () => {
    await element(by.id('date-picker-input')).tap();
    await expect(element(by.text('1'))).toBeNotVisible();
    await expect(element(by.text('31'))).toBeNotVisible();
  });

  it('should navigate between months', async () => {
    await element(by.id('date-picker-input')).tap();
    await element(by.id('next-month-button')).tap();
    await expect(element(by.id('month-year-label'))).toHaveText(expect.stringMatching(/\w+ \d{4}/));
    await element(by.id('prev-month-button')).tap();
    await expect(element(by.id('month-year-label'))).toHaveText(expect.stringMatching(/\w+ \d{4}/));
  });

  it('should handle year selection', async () => {
    await element(by.id('date-picker-input')).tap();
    await element(by.id('year-selector')).tap();
    await element(by.text('2024')).tap();
    await expect(element(by.id('month-year-label'))).toHaveText(expect.stringMatching(/\w+ 2024/));
  });
});
