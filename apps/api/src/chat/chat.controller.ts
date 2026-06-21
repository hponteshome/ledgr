import {
  Controller, Get, Post, Body, Param, Patch,
  UseGuards, Request, Sse, MessageEvent, Query,
} from '@nestjs/common';
import { Observable, filter, map } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto, UpdateConversationDto } from './dto/chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // SSE — stream de eventos em tempo real
  @Sse('stream')
  stream(@Request() req): Observable<MessageEvent> {
    const userId = req.user.id;
    return this.chatService.events$.pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ data: JSON.stringify(e.data) }) as MessageEvent),
    );
  }

  // Conversas
  @Get('conversations')
  list(@Request() req) {
    return this.chatService.listConversations(req.user.id);
  }

  @Post('conversations')
  create(@Request() req, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(req.user.id, dto);
  }

  @Get('conversations/:id')
  getOne(@Request() req, @Param('id') id: string) {
    return this.chatService.getConversation(req.user.id, id);
  }

  // Mensagens
  @Get('conversations/:id/messages')
  messages(@Request() req, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.chatService.listMessages(req.user.id, id, cursor);
  }

  @Post('conversations/:id/messages')
  send(@Request() req, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(req.user.id, id, dto);
  }

  @Patch('conversations/:id/read')
  markRead(@Request() req, @Param('id') id: string) {
    return this.chatService.markAsRead(req.user.id, id);
  }

  // Grupo
  @Post('conversations/:id/participants/:userId')
  addParticipant(@Request() req, @Param('id') id: string, @Param('userId') targetId: string) {
    return this.chatService.addParticipant(req.user.id, id, targetId);
  }

  @Patch('conversations/:id/leave')
  leave(@Request() req, @Param('id') id: string) {
    return this.chatService.leaveConversation(req.user.id, id);
  }
}
