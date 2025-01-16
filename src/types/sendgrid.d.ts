declare module '@sendgrid/mail' {
  interface EmailData {
    to: string | string[];
    from: string;
    subject: string;
    text?: string;
    html?: string;
    templateId?: string;
    dynamicTemplateData?: Record<string, any>;
    attachments?: Array<{
      content: string;
      filename: string;
      type?: string;
      disposition?: string;
      contentId?: string;
    }>;
    categories?: string[];
    customArgs?: Record<string, string>;
    sendAt?: number;
    batchId?: string;
    asm?: {
      groupId: number;
      groupsToDisplay?: number[];
    };
    ipPoolName?: string;
    mailSettings?: {
      bypassListManagement?: {
        enable?: boolean;
      };
      footer?: {
        enable?: boolean;
        text?: string;
        html?: string;
      };
      sandboxMode?: {
        enable?: boolean;
      };
      spamCheck?: {
        enable?: boolean;
        threshold?: number;
        postToUrl?: string;
      };
    };
    trackingSettings?: {
      clickTracking?: {
        enable?: boolean;
        enableText?: boolean;
      };
      openTracking?: {
        enable?: boolean;
        substitutionTag?: string;
      };
      subscriptionTracking?: {
        enable?: boolean;
        text?: string;
        html?: string;
        substitutionTag?: string;
      };
      ganalytics?: {
        enable?: boolean;
        utmSource?: string;
        utmMedium?: string;
        utmTerm?: string;
        utmContent?: string;
        utmCampaign?: string;
      };
    };
  }

  interface ClientResponse {
    statusCode: number;
    body: any;
    headers: Record<string, string>;
  }

  interface MailService {
    setApiKey(apiKey: string): void;
    send(data: EmailData | EmailData[]): Promise<[ClientResponse, {}]>;
    sendMultiple(data: EmailData): Promise<[ClientResponse, {}]>;
    setSubstitutionWrappers(left: string, right: string): void;
    setDefaultRequest(defaultRequest: Record<string, any>): void;
  }

  const mail: MailService;
  export = mail;
}
