import { ErrorReporting } from '@google-cloud/error-reporting';

let errorReporting: ErrorReporting | null = null;

if (process.env.GOOGLE_CLOUD_PROJECT) {
  try {
    errorReporting = new ErrorReporting({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    console.log('Google Cloud Error Reporting initialized.');
  } catch (error) {
    console.error('Failed to initialize Google Cloud Error Reporting:', error);
  }
}

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(...args: any[]): void {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  public warn(...args: any[]): void {
    console.warn(...args);
  }

  public error(error: Error | string, ...args: any[]): void {
    console.error(error, ...args);
    if (error instanceof Error) {
      errorReporting?.report(error);
    } else if (typeof error === 'string') {
      errorReporting?.report(new Error(error));
    }
  }

  public debug(...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(...args);
    }
  }
}

export const logger = Logger.getInstance();
