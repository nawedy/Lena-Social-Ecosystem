export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  updatedAt: Date;
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
  reactions?: MessageReaction[];
  replyTo?: string;
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
  type: 'direct' | 'group';
  participants: string[];
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    name?: string;
    description?: string;
    avatar?: string;
    customData?: Record<string, any>;
  };
  status: 'active' | 'archived' | 'deleted';
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
  type?: 'direct' | 'group';
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
