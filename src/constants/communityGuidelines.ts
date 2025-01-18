export const CommunityGuidelines = {
  version: '1.0.0',
  lastUpdated: '2025-01-14',

  introduction: {
    title: 'TikTokToe Community Guidelines',
    description: `
      Welcome to TikTokToe! Our community guidelines are designed to ensure a safe,
      inclusive, and enjoyable environment for all users. By using TikTokToe, you
      agree to follow these guidelines and help maintain our community standards.
    `,
  },

  principles: [
    {
      title: 'Safety First',
      description: 'We prioritize the safety and well-being of our community members.',
    },
    {
      title: 'Respect for All',
      description: 'We embrace diversity and require mutual respect among all users.',
    },
    {
      title: 'Authenticity',
      description: 'We encourage genuine interactions and authentic content.',
    },
    {
      title: 'Creativity',
      description: 'We celebrate creative expression while maintaining community standards.',
    },
  ],

  rules: {
    harassment: {
      title: 'No Harassment or Bullying',
      description: 'We do not tolerate any form of harassment, bullying, or intimidation.',
      examples: [
        'Personal attacks or insults',
        'Targeted harassment campaigns',
        'Encouraging others to harass',
        'Unwanted sexual advances',
        'Revealing private information',
      ],
      severity: 'high',
    },

    hateSpeech: {
      title: 'No Hate Speech or Discrimination',
      description: 'Content promoting hate or discrimination is strictly prohibited.',
      examples: [
        'Attacks based on protected characteristics',
        'Discriminatory slurs or symbols',
        'Promoting hate groups or ideologies',
        'Content denying tragic events',
      ],
      severity: 'high',
    },

    violence: {
      title: 'No Violence or Threats',
      description: 'Content promoting or glorifying violence is not allowed.',
      examples: [
        'Threats of physical harm',
        'Promoting dangerous organizations',
        'Graphic violence or gore',
        'Encouraging self-harm',
      ],
      severity: 'high',
    },

    adultContent: {
      title: 'No Adult or Explicit Content',
      description: 'TikTokToe is a family-friendly platform. Adult content is prohibited.',
      examples: [
        'Nudity or sexual content',
        'Sexually suggestive material',
        'Content involving minors',
        'Explicit language',
      ],
      severity: 'high',
    },

    spam: {
      title: 'No Spam or Manipulation',
      description: 'Artificial engagement and spam content are prohibited.',
      examples: [
        'Automated posting',
        'Fake accounts or bots',
        'Misleading information',
        'Excessive self-promotion',
      ],
      severity: 'medium',
    },

    intellectual: {
      title: 'Respect Intellectual Property',
      description: 'Respect copyright and intellectual property rights.',
      examples: [
        'Unauthorized use of copyrighted material',
        'Impersonating others',
        'Stealing content',
        'False attribution',
      ],
      severity: 'medium',
    },
  },

  enforcement: {
    actions: [
      {
        type: 'warning',
        description: 'First-time or minor violations may result in a warning.',
      },
      {
        type: 'content-removal',
        description: 'Violating content will be removed from the platform.',
      },
      {
        type: 'temporary-suspension',
        description: 'Repeated violations may result in temporary account suspension.',
        durations: ['24 hours', '7 days', '30 days'],
      },
      {
        type: 'permanent-ban',
        description: 'Severe or repeated violations may result in permanent account termination.',
      },
    ],

    appeals: {
      description: `
        Users have the right to appeal enforcement actions. Appeals will be reviewed
        by our moderation team within 48 hours.
      `,
      process: [
        'Submit appeal through the app',
        'Provide explanation and context',
        'Wait for moderator review',
        'Receive final decision',
      ],
    },
  },

  reporting: {
    description: `
      Help keep TikTokToe safe by reporting content that violates our guidelines.
      Our AI-powered moderation system and human moderators will review all reports.
    `,
    steps: [
      'Click the report button on the content',
      'Select the violation type',
      'Provide additional context',
      'Submit the report',
    ],
    response: 'Reports are typically reviewed within 24 hours.',
  },

  privacy: {
    description: `
      Protect your privacy and respect others' privacy rights. Do not share personal
      information without consent.
    `,
    recommendations: [
      'Use strong privacy settings',
      'Be careful with personal information',
      "Respect others' privacy choices",
      'Report privacy violations',
    ],
  },

  updates: {
    description: `
      These guidelines may be updated periodically. Users will be notified of
      significant changes.
    `,
    notification: {
      method: 'In-app notification and email',
      timing: '30 days before major changes',
    },
  },
};
