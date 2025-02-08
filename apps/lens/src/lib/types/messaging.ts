export type MessageType = 
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'voice'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'reply'
  | 'system';

export type MessageStatus = 
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type ChatType = 
  | 'direct'
  | 'group'
  | 'channel';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: {
    text?: string;
    mediaUrl?: string;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    thumbnail?: string;
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
    };
    contact?: {
      name: string;
      phone?: string;
      email?: string;
    };
    reactionType?: string;
    replyTo?: string;
  };
  metadata: {
    encryptedKey?: string;
    iv?: string;
    signature?: string;
  };
  status: MessageStatus;
  reactions?: Array<{
    userId: string;
    type: string;
    timestamp: string;
  }>;
  replyCount?: number;
  threadId?: string;
  editedAt?: string;
  deletedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  description?: string;
  avatar?: string;
  participants: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
  }>;
  lastMessage?: Message;
  unreadCount: number;
  settings: {
    encryption: boolean;
    disappearingMessages?: number;
    notifications: boolean;
    muteUntil?: string;
    pinned: boolean;
    archived: boolean;
  };
  metadata: {
    groupKey?: string;
    inviteLink?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VoiceRecording {
  id: string;
  url: string;
  duration: number;
  waveform: number[];
  transcription?: string;
  status: 'recording' | 'processing' | 'ready' | 'failed';
}

export interface MessageDraft {
  id: string;
  chatId: string;
  type: MessageType;
  content: Message['content'];
  attachments: Array<{
    file: File;
    progress: number;
    error?: string;
  }>;
  replyTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatPreferences {
  chatId: string;
  notifications: {
    enabled: boolean;
    sound: boolean;
    preview: boolean;
    muteUntil?: string;
  };
  encryption: {
    enabled: boolean;
    disappearingMessages?: number;
  };
  appearance: {
    wallpaper?: string;
    color?: string;
    fontSize: 'small' | 'medium' | 'large';
  };
  privacy: {
    readReceipts: boolean;
    typingIndicator: boolean;
    lastSeen: boolean;
  };
}

export interface MessageReaction {
  messageId: string;
  userId: string;
  type: string;
  timestamp: string;
}

export interface MessageThread {
  messageId: string;
  replyCount: number;
  lastReplyAt: string;
  participants: string[];
}

export interface ChatInvite {
  id: string;
  chatId: string;
  inviterId: string;
  code: string;
  maxUses?: number;
  useCount: number;
  expiresAt?: string;
  createdAt: string;
}

export interface ChatEvent {
  id: string;
  chatId: string;
  type: 
    | 'member_joined'
    | 'member_left'
    | 'member_added'
    | 'member_removed'
    | 'role_changed'
    | 'chat_created'
    | 'chat_updated'
    | 'encryption_enabled'
    | 'encryption_disabled';
  userId: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface VoiceTranscriptionResult {
  text: string;
  confidence: number;
  words: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
  language: string;
}

export interface ChatAnalytics {
  chatId: string;
  messageCount: number;
  activeUsers: number;
  averageResponseTime: number;
  peakHours: Record<number, number>;
  topContributors: Array<{
    userId: string;
    messageCount: number;
  }>;
  mediaShared: {
    images: number;
    videos: number;
    files: number;
    voice: number;
  };
  period: {
    start: string;
    end: string;
  };
} 