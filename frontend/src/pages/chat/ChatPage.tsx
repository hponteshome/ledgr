// frontend/src/pages/chat/ChatPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
import { useAuth } from '../../contexts/AuthContext';
import {
  FiSend, FiPlus, FiSearch, FiUsers, FiMoreVertical,
  FiPaperclip, FiX, FiCheck,
} from 'react-icons/fi';

interface ConvUser { id: string; fullName: string; nickname: string | null; }
interface LastMessage { id: string; body: string | null; type: string; sender: ConvUser; createdAt: string; }
interface Conversation {
  id: string; type: 'DIRECT' | 'GROUP'; name: string | null;
  participants: { user: ConvUser }[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  updatedAt: string;
}
interface Message {
  id: string; body: string | null; type: string; senderId: string;
  sender: ConvUser; createdAt: string; editedAt: string | null;
  contextType?: string; contextLabel?: string;
  replyTo?: { id: string; body: string | null; sender: { fullName: string } } | null;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const COLORS = ['#E1F5EE', '#E6F1FB', '#FAEEDA', '#FAECE7', '#EEEDFE'];
const TEXT_COLORS = ['#0F6E56', '#185FA5', '#854F0B', '#993C1D', '#534AB7'];
function avatarColor(id: string): { bg: string; color: string } {
  const i = id.charCodeAt(0) % COLORS.length;
  return { bg: COLORS[i], color: TEXT_COLORS[i] };
}

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [allUsers, setAllUsers] = useState<ConvUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadConversations = useCallback(async () => {
    const { data } = await api.get<Conversation[]>('/chat/conversations');
    setConversations(data);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // SSE
  useEffect(() => {
    const token = localStorage.getItem('@ledgr:token');
    if (!token) return;
    const es = new EventSource(`${API}/chat/stream?token=${token}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'NEW_MESSAGE') {
        const msg: Message = event.message;
        setMessages(prev =>
          prev.find(m => m.id === msg.id) ? prev : [...prev, msg]
        );
        loadConversations();
      }
    };
    eventSourceRef.current = es;
    return () => es.close();
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setLoading(true);
    const { data } = await api.get<Message[]>(`/chat/conversations/${conv.id}/messages`);
    setMessages(data);
    setLoading(false);
    await api.patch(`/chat/conversations/${conv.id}/read`);
  };

  const sendMessage = async () => {
    if (!activeConv || !body.trim()) return;
    const text = body.trim();
    setBody('');
    await api.post(`/chat/conversations/${activeConv.id}/messages`, { body: text, type: 'TEXT' });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const openNewModal = async () => {
    const { data } = await api.get<{ id: string; fullName: string; nickname: string | null }[]>('/users');
    setAllUsers(data.filter(u => u.id !== user?.id));
    setSelectedUsers([]); setGroupName(''); setIsGroup(false);
    setShowNewModal(true);
  };

  const createConversation = async () => {
    if (selectedUsers.length === 0) return;
    const dto = isGroup
      ? { type: 'GROUP', name: groupName || 'Novo grupo', participantIds: selectedUsers }
      : { type: 'DIRECT', participantIds: selectedUsers };
    const { data } = await api.post<Conversation>('/chat/conversations', dto);
    setShowNewModal(false);
    await loadConversations();
    openConversation(data);
  };

  const convName = (conv: Conversation): string => {
    if (conv.type === 'GROUP') return conv.name ?? 'Grupo';
    const other = conv.participants.find(p => p.user.id !== user?.id);
    return other?.user.nickname ?? other?.user.fullName ?? 'Conversa';
  };

  const filtered = conversations.filter(c =>
    convName(c).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#F9FAFB' }}>

      {/* Lista de conversas */}
      <div style={{ width: 300, borderRight: '0.5px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>Mensagens</span>
          <button onClick={openNewModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiPlus size={18} /><FiUsers size={16} />
          </button>
        </div>
        <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F3F4F6', borderRadius: 20, padding: '6px 12px' }}>
            <FiSearch size={14} color="#9CA3AF" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..." style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, color: '#374151', width: '100%' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(conv => {
            const name = convName(conv);
            const ac = avatarColor(conv.id);
            const isActive = activeConv?.id === conv.id;
            return (
              <div key={conv.id} onClick={() => openConversation(conv)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid #F5F5F5', background: isActive ? '#F0F9FF' : 'transparent' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: conv.type === 'GROUP' ? '#F3F4F6' : ac.bg, color: conv.type === 'GROUP' ? '#6B7280' : ac.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                  {conv.type === 'GROUP' ? <FiUsers size={16} /> : avatarInitials(name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                    {conv.lastMessage ? (conv.lastMessage.sender.id === user?.id ? 'Você: ' : '') + (conv.lastMessage.body ?? '📎') : 'Sem mensagens'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {conv.lastMessage && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{timeLabel(conv.lastMessage.createdAt)}</span>}
                  {conv.unreadCount > 0 && <span style={{ background: '#0369A1', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 500, padding: '1px 6px' }}>{conv.unreadCount}</span>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhuma conversa</div>}
        </div>
      </div>

      {/* Área de mensagens */}
      {activeConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: activeConv.type === 'GROUP' ? '#F3F4F6' : avatarColor(activeConv.id).bg, color: activeConv.type === 'GROUP' ? '#6B7280' : avatarColor(activeConv.id).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 }}>
              {activeConv.type === 'GROUP' ? <FiUsers size={15} /> : avatarInitials(convName(activeConv))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{convName(activeConv)}</div>
              {activeConv.type === 'GROUP' && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{activeConv.participants.length} participantes</div>}
            </div>
            <FiMoreVertical size={18} color="#9CA3AF" style={{ cursor: 'pointer' }} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#F9FAFB', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loading && <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Carregando...</div>}
            {messages.map(msg => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                  {!isMe && activeConv.type === 'GROUP' && (
                    <span style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2, paddingLeft: 2 }}>
                      {msg.sender.nickname ?? msg.sender.fullName}
                    </span>
                  )}
                  <div style={{ maxWidth: '65%', padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, color: '#111', background: isMe ? '#E0F2FE' : '#fff', border: '0.5px solid', borderColor: isMe ? '#BAE6FD' : '#E5E7EB', borderBottomRightRadius: isMe ? 3 : 12, borderBottomLeftRadius: isMe ? 12 : 3 }}>
                    {msg.contextLabel && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 4, fontSize: 11, padding: '2px 7px', marginBottom: 6 }}>
                        {msg.contextLabel}
                      </div>
                    )}
                    {msg.replyTo && (
                      <div style={{ background: '#F3F4F6', borderLeft: '2px solid #0369A1', borderRadius: 4, padding: '4px 8px', marginBottom: 6, fontSize: 12, color: '#6B7280' }}>
                        <strong>{msg.replyTo.sender.fullName}</strong><br />{msg.replyTo.body}
                      </div>
                    )}
                    <div>{msg.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{timeLabel(msg.createdAt)}</span>
                      {isMe && <FiCheck size={11} color="#0369A1" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '10px 16px', borderTop: '0.5px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiPaperclip size={18} color="#9CA3AF" style={{ cursor: 'pointer' }} />
            <textarea value={body} onChange={e => setBody(e.target.value)} onKeyDown={handleKey}
              rows={1} placeholder="Digite uma mensagem..."
              style={{ flex: 1, background: '#F3F4F6', border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 13, color: '#374151', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            <button onClick={sendMessage} disabled={!body.trim()}
              style={{ width: 34, height: 34, borderRadius: '50%', background: body.trim() ? '#111' : '#E5E7EB', border: 'none', cursor: body.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiSend size={15} color={body.trim() ? '#fff' : '#9CA3AF'} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
          Selecione uma conversa ou inicie uma nova
        </div>
      )}

      {/* Modal nova conversa */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Nova conversa</span>
              <FiX size={18} style={{ cursor: 'pointer' }} onClick={() => setShowNewModal(false)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setIsGroup(false)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '0.5px solid', borderColor: !isGroup ? '#111' : '#E5E7EB', background: !isGroup ? '#111' : '#fff', color: !isGroup ? '#fff' : '#374151', fontSize: 13, cursor: 'pointer' }}>Direto</button>
              <button onClick={() => setIsGroup(true)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '0.5px solid', borderColor: isGroup ? '#111' : '#E5E7EB', background: isGroup ? '#111' : '#fff', color: isGroup ? '#fff' : '#374151', fontSize: 13, cursor: 'pointer' }}>Grupo</button>
            </div>
            {isGroup && (
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nome do grupo"
                style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            )}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allUsers.map(u => {
                const sel = selectedUsers.includes(u.id);
                const ac = avatarColor(u.id);
                return (
                  <div key={u.id} onClick={() => setSelectedUsers(prev => sel ? prev.filter(x => x !== u.id) : isGroup ? [...prev, u.id] : [u.id])}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: sel ? '#F0F9FF' : 'transparent', border: '0.5px solid', borderColor: sel ? '#BAE6FD' : 'transparent' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: ac.bg, color: ac.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 }}>{avatarInitials(u.fullName)}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{u.fullName}</div>
                      {u.nickname && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{u.nickname}</div>}
                    </div>
                    {sel && <FiCheck size={14} color="#0369A1" style={{ marginLeft: 'auto' }} />}
                  </div>
                );
              })}
            </div>
            <button onClick={createConversation} disabled={selectedUsers.length === 0}
              style={{ background: selectedUsers.length ? '#111' : '#E5E7EB', color: selectedUsers.length ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 500, cursor: selectedUsers.length ? 'pointer' : 'default' }}>
              {isGroup ? 'Criar grupo' : 'Iniciar conversa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
