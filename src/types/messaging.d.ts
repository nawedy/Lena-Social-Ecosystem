export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: {
    type: 'text' | 'image' | 'video' | 'audio' | 'file';
    text?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
    metadata?: {
      width?: number;
      height?: number;
      orientation?: number;
      location?: {
        latitude: number;
        longitude: number;
      };
    };
  };
  status: 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  reactions?: {
    type: string;
    userId: string;
    createdAt: Date;
  }[];
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
  };
  mentions?: string[];
  attachments?: MessageAttachment[];
}

export interface MessageReaction {
  userId: string;
  type: string;
  createdAt: Date;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    thumbnail?: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  participants: {
    userId: string;
    role: 'admin' | 'member';
    joinedAt: Date;
    lastReadAt?: Date;
  }[];
  metadata: {
    name?: string;
    description?: string;
    avatar?: string;
    customData?: Record<string, string | number | boolean>;
  };
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
  };
}

export interface MessageFilter {
  conversationId?: string;
  senderId?: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file';
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ConversationFilter {
  participantId?: string;
  type?: 'private' | 'group';
  status?: 'active' | 'archived' | 'deleted';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface MessageStats {
  totalMessages: number;
  unreadCount: number;
  failedCount: number;
  mediaCount: {
    images: number;
    videos: number;
    audios: number;
    files: number;
  };
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  deletedConversations: number;
  groupConversations: number;
  directConversations: number;
}

export interface ChatPreferences {
  notifications: boolean;
  muteUntil?: Date;
  pinnedMessageIds: string[];
  theme?: 'light' | 'dark' | 'system';
  customSettings?: Record<string, string | number | boolean>;
}
