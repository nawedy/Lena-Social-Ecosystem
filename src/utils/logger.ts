import { ErrorReporting } from '@google-cloud/error-reporting';

// Initialize Google Cloud Error Reporting
const errorReporting = new ErrorReporting({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

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
      errorReporting.report(error);
    } else {
      errorReporting.report(new Error(error));
    }
  }

  public debug(...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(...args);
    }
  }
}

export const logger = Logger.getInstance();
