import * as detox from 'detox';
import { device } from 'detox';

beforeAll(async () => {
  await detox.init({ launchApp: false });
});

afterAll(async () => {
  await detox.cleanup();
});

beforeEach(async () => {
  await device.launchApp();
  await device.reloadReactNative();
});

