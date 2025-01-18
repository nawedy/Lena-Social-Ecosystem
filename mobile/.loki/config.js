module.exports = {
  configurations: {
    'chrome.laptop': {
      target: 'chrome.app',
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
    },
    'chrome.iphone7': {
      target: 'chrome.app',
      preset: 'iPhone 7',
    },
    'ios.iphone12': {
      target: 'ios.simulator',
      device: 'iPhone 12',
    },
    'android.pixel4': {
      target: 'android.emulator',
      device: 'Pixel_4_API_30',
    },
  },
  fetchFailIgnore: [
    'localhost:1234', // for local development
  ],
  chromeSelector: '#storybook-root > *',
  diffingEngine: 'looks-same',
  requireReference: true,
  verboseRenderer: true,
  chromeTolerance: 0.1,
  chromeFlags: ['--no-sandbox', '--disable-web-security'],
};
