import {
  Firestore,
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  arrayUnion,
} from 'firebase/firestore';
import { Message, Conversation } from '../types/messaging';
import { User } from '../types/user';
import { NotificationService } from './NotificationService';
import { BlockingService } from './BlockingService';

export class MessagingService {
  private static instance: MessagingService;
  private db: Firestore;
  private notificationService: NotificationService;
  private blockingService: BlockingService;

  private constructor() {
    this.db = getFirestore();
    this.notificationService = NotificationService.getInstance();
    this.blockingService = BlockingService.getInstance();
  }

  public static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text'
  ): Promise<Message> {
    // Check if sender is blocked
    const isBlocked = await this.blockingService.isUserBlocked(senderId);
    if (isBlocked) {
      throw new Error('You are not allowed to send messages');
    }

    const message: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId,
      content,
      type,
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(this.db, 'messages', message.id), message, {
      merge: true,
    });
    await this.updateConversationLastMessage(conversationId, message);
    await this.notifyRecipients(conversationId, senderId, message);

    return message;
  }

  async createConversation(participants: string[]): Promise<Conversation> {
    // Verify no blocking between participants
    for (const participant of participants) {
      const isBlocked = await this.blockingService.isUserBlocked(participant);
      if (isBlocked) {
        throw new Error(
          `Unable to create conversation due to blocking restrictions`
        );
      }
    }

    const conversation: Conversation = {
      id: `conv_${Date.now()}`,
      participants,
      type: participants.length > 2 ? 'group' : 'direct',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessage: null,
      metadata: {},
    };

    await setDoc(doc(this.db, 'conversations', conversation.id), conversation, {
      merge: true,
    });
    return conversation;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const conversationDoc = await getDoc(
      doc(this.db, 'conversations', conversationId)
    );
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }
    return conversationDoc.data() as Conversation;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    const conversationsQuery = query(
      collection(this.db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(conversationsQuery);
    return snapshot.docs.map(doc => doc.data() as Conversation);
  }

  async getConversationMessages(
    conversationId: string,
    messageLimit: number = 50
  ): Promise<Message[]> {
    const messagesQuery = query(
      collection(this.db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'desc'),
      limit(messageLimit)
    );

    const snapshot = await getDocs(messagesQuery);
    return snapshot.docs.map(doc => doc.data() as Message);
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    await updateDoc(doc(this.db, 'messages', messageId), {
      readBy: arrayUnion(userId),
      status: 'read',
      updatedAt: new Date(),
    });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const messageDoc = await getDoc(doc(this.db, 'messages', messageId));
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const messageData = messageDoc.data() as Message;
    if (messageData.senderId !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    await updateDoc(doc(this.db, 'messages', messageId), {
      content: 'This message has been deleted',
      status: 'deleted',
      updatedAt: new Date(),
    });
  }

  private async updateConversationLastMessage(
    conversationId: string,
    message: Message
  ): Promise<void> {
    await updateDoc(doc(this.db, 'conversations', conversationId), {
      lastMessage: {
        content: message.content,
        createdAt: message.createdAt,
        senderId: message.senderId,
      },
      updatedAt: new Date(),
    });
  }

  private async notifyRecipients(
    conversationId: string,
    senderId: string,
    message: Message
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    const recipients = conversation.participants.filter(id => id !== senderId);

    for (const recipientId of recipients) {
      await this.notificationService.sendNotification(recipientId, {
        type: 'new_message',
        title: 'New Message',
        body:
          message.type === 'text'
            ? message.content
            : `Sent you a ${message.type}`,
        data: {
          conversationId,
          messageId: message.id,
        },
      });
    }
  }

  async searchMessages(
    userId: string,
    searchQuery: string
  ): Promise<Message[]> {
    const userConversations = await this.getUserConversations(userId);
    const conversationIds = userConversations.map(
      conversation => conversation.id
    );

    const messagesQuery = query(
      collection(this.db, 'messages'),
      where('conversationId', 'in', conversationIds),
      where('content', '>=', searchQuery),
      where('content', '<=', searchQuery + '\uf8ff'),
      limit(20)
    );

    const snapshot = await getDocs(messagesQuery);
    return snapshot.docs.map(doc => doc.data() as Message);
  }
}
