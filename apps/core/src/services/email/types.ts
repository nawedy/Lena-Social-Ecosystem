export interface EmailConfig {
  /**
   * Recipient email address
   */
  to: string | string[];

  /**
   * Email subject
   */
  subject: string;

  /**
   * Plain text version of the email
   */
  text?: string;

  /**
   * HTML version of the email
   */
  html?: string;

  /**
   * Sender email address
   * If not provided, will use the default from SMTP_FROM environment variable
   */
  from?: string;

  /**
   * CC recipients
   */
  cc?: string | string[];

  /**
   * BCC recipients
   */
  bcc?: string | string[];

  /**
   * Reply-to email address
   */
  replyTo?: string;

  /**
   * Email attachments
   */
  attachments?: Array<{
    /**
     * Filename to be reported as the name of the attached file
     */
    filename?: string;

    /**
     * Path to file to include as attachment
     */
    path?: string;

    /**
     * String, Buffer or Stream contents for the attachment
     */
    content?: string | Buffer | NodeJS.ReadableStream;

    /**
     * Content type for the attachment
     */
    contentType?: string;

    /**
     * Content disposition type for the attachment
     */
    contentDisposition?: 'attachment' | 'inline';

    /**
     * Content ID for the attachment for inline images
     */
    cid?: string;

    /**
     * Optional content encoding for the attachment
     */
    encoding?: string;
  }>;
}

export interface EmailTemplate {
  /**
   * Template ID
   */
  id: string;

  /**
   * Template name
   */
  name: string;

  /**
   * Template description
   */
  description?: string;

  /**
   * Subject template
   */
  subject: string;

  /**
   * Plain text template
   */
  text?: string;

  /**
   * HTML template
   */
  html?: string;

  /**
   * Template variables
   */
  variables: Array<{
    /**
     * Variable name
     */
    name: string;

    /**
     * Variable description
     */
    description?: string;

    /**
     * Variable type
     */
    type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';

    /**
     * Whether the variable is required
     */
    required: boolean;

    /**
     * Default value
     */
    default?: any;
  }>;

  /**
   * Created at timestamp
   */
  created_at?: string;

  /**
   * Updated at timestamp
   */
  updated_at?: string;
} 