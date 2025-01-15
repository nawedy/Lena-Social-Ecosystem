import { FirebaseFirestore, DocumentData } from '@firebase/firestore';
import { getFirestore, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Message, Chat, MessageStatus } from '../types/messaging';
import { User } from '../types/user';
import { NotificationService } from './NotificationService';
import { BlockingService } from './BlockingService';

export class MessagingService {
  private static instance: MessagingService;
  private db: FirebaseFirestore;
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

  async sendMessage(chatId: string, senderId: string, content: string, type: 'text' | 'image' | 'video' = 'text'): Promise<Message> {
    // Check if sender is blocked
    const isBlocked = await this.blockingService.isUserBlocked(senderId);
    if (isBlocked) {
      throw new Error('You are not allowed to send messages');
    }

    const message: Message = {
      id: `msg_${Date.now()}`,
      chatId,
      senderId,
      content,
      type,
      timestamp: new Date(),
      status: MessageStatus.SENT,
      readBy: [],
    };

    await this.db.collection('messages').add(message);
    await this.updateChatLastMessage(chatId, message);
    await this.notifyRecipients(chatId, senderId, message);

    return message;
  }

  async createChat(participants: string[]): Promise<Chat> {
    // Verify no blocking between participants
    for (const participant of participants) {
      const isBlocked = await this.blockingService.isUserBlocked(participant);
      if (isBlocked) {
        throw new Error(`Unable to create chat due to blocking restrictions`);
      }
    }

    const chat: Chat = {
      id: `chat_${Date.now()}`,
      participants,
      createdAt: new Date(),
      lastMessage: null,
      type: participants.length > 2 ? 'group' : 'direct',
    };

    await this.db.collection('chats').add(chat);
    return chat;
  }

  async getChat(chatId: string): Promise<Chat> {
    const chatDoc = await this.db.collection('chats').doc(chatId).get();
    return chatDoc.data() as Chat;
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    const chatsQuery = query(
      collection(this.db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const snapshot = await chatsQuery.get();
    return snapshot.docs.map(doc => doc.data() as Chat);
  }

  async getChatMessages(chatId: string, limit: number = 50): Promise<Message[]> {
    const messagesQuery = query(
      collection(this.db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('timestamp', 'desc'),
      limit(limit)
    );

    const snapshot = await messagesQuery.get();
    return snapshot.docs.map(doc => doc.data() as Message);
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    await this.db.collection('messages').doc(messageId).update({
      readBy: FirebaseFirestore.FieldValue.arrayUnion(userId),
      status: MessageStatus.READ,
    });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const messageRef = this.db.collection('messages').doc(messageId);
    const message = await messageRef.get();

    if (!message.exists) {
      throw new Error('Message not found');
    }

    const messageData = message.data() as Message;
    if (messageData.senderId !== userId) {
      throw new Error('Unauthorized to delete this message');
    }

    await messageRef.update({
      content: 'This message has been deleted',
      status: MessageStatus.DELETED,
    });
  }

  private async updateChatLastMessage(chatId: string, message: Message): Promise<void> {
    await this.db.collection('chats').doc(chatId).update({
      lastMessage: {
        content: message.content,
        timestamp: message.timestamp,
        senderId: message.senderId,
      },
    });
  }

  private async notifyRecipients(chatId: string, senderId: string, message: Message): Promise<void> {
    const chat = await this.getChat(chatId);
    const recipients = chat.participants.filter(id => id !== senderId);

    for (const recipientId of recipients) {
      await this.notificationService.sendNotification(recipientId, {
        type: 'new_message',
        title: 'New Message',
        body: message.type === 'text' ? message.content : `Sent you a ${message.type}`,
        data: {
          chatId,
          messageId: message.id,
        },
      });
    }
  }

  async searchMessages(userId: string, query: string): Promise<Message[]> {
    const userChats = await this.getUserChats(userId);
    const chatIds = userChats.map(chat => chat.id);

    const messagesQuery = query(
      collection(this.db, 'messages'),
      where('chatId', 'in', chatIds),
      where('content', '>=', query),
      where('content', '<=', query + '\uf8ff'),
      limit(20)
    );

    const snapshot = await messagesQuery.get();
    return snapshot.docs.map(doc => doc.data() as Message);
  }
}
