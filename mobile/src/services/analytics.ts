import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

interface EventProperties {
  [key: string]: any;
}

interface UserProperties {
  [key: string]: string;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async initialize() {
    try {
      if (this.initialized) return;

      // Initialize device information
      const deviceInfo = {
        appVersion: await DeviceInfo.getVersion(),
        buildNumber: await DeviceInfo.getBuildNumber(),
        deviceId: await DeviceInfo.getUniqueId(),
        manufacturer: await DeviceInfo.getManufacturer(),
        model: await DeviceInfo.getModel(),
        systemVersion: await DeviceInfo.getSystemVersion(),
        platform: Platform.OS,
      };

      // Set default crash attributes
      await crashlytics().setAttribute('app_version', deviceInfo.appVersion);
      await crashlytics().setAttribute('build_number', deviceInfo.buildNumber);
      await crashlytics().setAttribute('device_id', deviceInfo.deviceId);
      await crashlytics().setAttribute('manufacturer', deviceInfo.manufacturer);
      await crashlytics().setAttribute('model', deviceInfo.model);
      await crashlytics().setAttribute(
        'system_version',
        deviceInfo.systemVersion
      );
      await crashlytics().setAttribute('platform', deviceInfo.platform);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  async logEvent(eventName: string, properties?: EventProperties) {
    try {
      await analytics().logEvent(eventName, properties);
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  async setUserProperties(properties: UserProperties) {
    try {
      const entries = Object.entries(properties);
      for (const [key, value] of entries) {
        await analytics().setUserProperty(key, value);
      }
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }

  async setUserId(userId: string | null) {
    try {
      await analytics().setUserId(userId);
      await crashlytics().setUserId(userId || '');
    } catch (error) {
      console.error('Failed to set user ID:', error);
    }
  }

  async logScreenView(screenName: string, screenClass?: string) {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error('Failed to log screen view:', error);
    }
  }

  async logError(error: Error, fatal = false) {
    try {
      await crashlytics().recordError(error);
      await analytics().logEvent('app_error', {
        error_name: error.name,
        error_message: error.message,
        fatal,
      });
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  }

  async logNavigation(from: string, to: string) {
    try {
      await this.logEvent('navigation', {
        from_screen: from,
        to_screen: to,
      });
    } catch (error) {
      console.error('Failed to log navigation:', error);
    }
  }

  async logTiming(category: string, name: string, milliseconds: number) {
    try {
      await this.logEvent('timing', {
        timing_category: category,
        timing_name: name,
        timing_duration: milliseconds,
      });
    } catch (error) {
      console.error('Failed to log timing:', error);
    }
  }

  async logSearch(searchTerm: string, category?: string) {
    try {
      await analytics().logSearch({
        search_term: searchTerm,
        search_category: category,
      });
    } catch (error) {
      console.error('Failed to log search:', error);
    }
  }

  async enableAnalytics(enabled: boolean) {
    try {
      await analytics().setAnalyticsCollectionEnabled(enabled);
      await crashlytics().setCrashlyticsCollectionEnabled(enabled);
    } catch (error) {
      console.error('Failed to set analytics enabled:', error);
    }
  }

  async logPerformanceMetric(name: string, value: number, unit: string) {
    try {
      await this.logEvent('performance_metric', {
        metric_name: name,
        metric_value: value,
        metric_unit: unit,
      });
    } catch (error) {
      console.error('Failed to log performance metric:', error);
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
