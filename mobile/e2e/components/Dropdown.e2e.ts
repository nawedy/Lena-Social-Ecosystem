import { by, device, element, expect } from 'detox';

describe('Dropdown', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await element(by.id('dropdownTestScreen')).tap();
  });

  it('should open dropdown when tapped', async () => {
    await element(by.id('dropdown')).tap();
    await expect(element(by.id('dropdownList'))).toBeVisible();
  });

  it('should select an item', async () => {
    await element(by.id('dropdown')).tap();
    await element(by.text('Option 1')).tap();
    await expect(element(by.text('Option 1'))).toBeVisible();
    await expect(element(by.id('dropdownList'))).not.toBeVisible();
  });

  it('should handle multiple selection', async () => {
    await element(by.id('multipleDropdown')).tap();
    await element(by.text('Option 1')).tap();
    await element(by.text('Option 2')).tap();
    await element(by.id('dropdownDoneButton')).tap();

    await expect(element(by.text('Option 1, Option 2'))).toBeVisible();
  });

  it('should filter items when searching', async () => {
    await element(by.id('searchableDropdown')).tap();
    await element(by.id('dropdownSearchInput')).typeText('Option 1');

    await expect(element(by.text('Option 1'))).toBeVisible();
    await expect(element(by.text('Option 2'))).not.toBeVisible();
  });

  it('should show error when required and empty', async () => {
    await element(by.id('requiredDropdown')).tap();
    await element(by.id('dropdownCancelButton')).tap();
    await element(by.id('submitButton')).tap();

    await expect(element(by.text('Selection required'))).toBeVisible();
  });

  it('should be disabled when disabled prop is true', async () => {
    await element(by.id('disabledDropdown')).tap();
    await expect(element(by.id('dropdownList'))).not.toBeVisible();
  });

  it('should show loading state', async () => {
    await element(by.id('loadingDropdown')).tap();
    await expect(element(by.id('dropdownLoadingIndicator'))).toBeVisible();
  });

  it('should clear selection when clear button is pressed', async () => {
    // First select an item
    await element(by.id('dropdown')).tap();
    await element(by.text('Option 1')).tap();

    // Then clear it
    await element(by.id('dropdownClearButton')).tap();
    await expect(element(by.text('Select an option'))).toBeVisible();
  });

  it('should handle disabled items', async () => {
    await element(by.id('dropdownWithDisabledItems')).tap();
    await element(by.text('Disabled Option')).tap();
    await expect(element(by.id('dropdownList'))).toBeVisible(); // List should stay open
  });

  it('should render items with icons', async () => {
    await element(by.id('dropdownWithIcons')).tap();
    await expect(element(by.id('icon-home'))).toBeVisible();
    await expect(element(by.id('icon-settings'))).toBeVisible();
  });

  it('should handle keyboard input for search', async () => {
    await element(by.id('searchableDropdown')).tap();
    await element(by.id('dropdownSearchInput')).typeText('Op');

    await expect(element(by.text('Option 1'))).toBeVisible();
    await expect(element(by.text('Option 2'))).toBeVisible();
    await expect(element(by.text('Other'))).not.toBeVisible();
  });

  it('should close dropdown when clicking outside', async () => {
    await element(by.id('dropdown')).tap();
    await expect(element(by.id('dropdownList'))).toBeVisible();

    await element(by.id('outsideArea')).tap();
    await expect(element(by.id('dropdownList'))).not.toBeVisible();
  });

  it('should maintain selected values after reopening', async () => {
    // Select multiple items
    await element(by.id('multipleDropdown')).tap();
    await element(by.text('Option 1')).tap();
    await element(by.text('Option 2')).tap();
    await element(by.id('dropdownDoneButton')).tap();

    // Reopen dropdown
    await element(by.id('multipleDropdown')).tap();

    // Check that items are still selected
    await expect(element(by.id('checkbox-Option-1-checked'))).toBeVisible();
    await expect(element(by.id('checkbox-Option-2-checked'))).toBeVisible();
  });

  it('should handle long item lists with scrolling', async () => {
    await element(by.id('dropdownWithLongList')).tap();
    await element(by.id('dropdownList')).scroll(500, 'down');
    await expect(element(by.text('Option 50'))).toBeVisible();
  });
});
