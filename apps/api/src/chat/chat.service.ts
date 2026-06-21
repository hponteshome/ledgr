import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { Subject } from 'rxjs';

export interface SseEvent {
  userId: string;
  data: unknown;
}

@Injectable()
export class ChatService {
  private eventBus = new Subject<SseEvent>();
  events$ = this.eventBus.asObservable();

  constructor(private prisma: PrismaService) {}

  // ── Conversas ────────────────────────────────────────────

  async createConversation(userId: string, dto: CreateConversationDto) {
    const allParticipants = [...new Set([userId, ...dto.participantIds])];

    // Para DIRECT: verificar se já existe conversa entre os dois
    if (dto.type === 'DIRECT' && allParticipants.length === 2) {
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          participants: { every: { userId: { in: allParticipants } } },
          deletedAt: null,
        },
        include: { participants: true },
      });
      if (existing && existing.participants.length === 2) return existing;
    }

    return this.prisma.conversation.create({
      data: {
        type: dto.type,
        name: dto.name,
        companyId: dto.companyId,
        createdById: userId,
        participants: {
          create: allParticipants.map((uid) => ({
            userId: uid,
            role: uid === userId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: { participants: { include: { user: { select: { id: true, fullName: true, nickname: true } } } } },
    });
  }

  async listConversations(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId, leftAt: null },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, fullName: true, nickname: true } } },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { fullName: true, nickname: true } } },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return participations.map((p) => {
      const conv = p.conversation;
      const lastMsg = conv.messages[0] ?? null;
      const unread = 0; // calculado abaixo se necessário
      return { ...conv, lastMessage: lastMsg, unreadCount: unread, myLastReadAt: p.lastReadAt };
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Sem acesso a esta conversa');

    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, nickname: true } } },
        },
      },
    });
  }

  // ── Mensagens ────────────────────────────────────────────

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Sem acesso a esta conversa');

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        body: dto.body,
        type: dto.type ?? 'TEXT',
        replyToId: dto.replyToId,
        contextType: dto.contextType,
        contextId: dto.contextId,
        contextLabel: dto.contextLabel,
      },
      include: {
        sender: { select: { id: true, fullName: true, nickname: true } },
        replyTo: { select: { id: true, body: true, sender: { select: { fullName: true } } } },
      },
    });

    // Atualizar updatedAt da conversa
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Emitir SSE para todos os participantes
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
    });
    for (const p of participants) {
      this.eventBus.next({ userId: p.userId, data: { type: 'NEW_MESSAGE', message } });
    }

    return message;
  }

  async listMessages(userId: string, conversationId: string, cursor?: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Sem acesso a esta conversa');

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId, deletedAt: null },
      include: {
        sender: { select: { id: true, fullName: true, nickname: true } },
        replyTo: { select: { id: true, body: true, sender: { select: { fullName: true } } } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return messages.reverse();
  }

  async markAsRead(userId: string,  conversationId: string) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  // ── Grupos ───────────────────────────────────────────────

  async addParticipant(userId: string, conversationId: string, targetUserId: string) {
    const me = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!me || me.role !== 'ADMIN') throw new ForbiddenException('Apenas admins podem adicionar membros');

    return this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      update: { leftAt: null, joinedAt: new Date() },
      create: { conversationId, userId: targetUserId, role: 'MEMBER' },
    });
  }

  async leaveConversation(userId: string, conversationId: string) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { leftAt: new Date() },
    });
  }
}
