import { api } from '@/lib/api';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
  _id: string;
  sender: { _id: string; name: string };
  senderRole: 'customer' | 'worker';
  text: string;
  createdAt: string;
  readBy: string[];
}

interface Props {
  bookingId: string;
  currentUserId: string;
  currentUserRole: 'customer' | 'worker';
  otherPartyName: string;
  onClose: () => void;
}

export default function ChatModal({ bookingId, currentUserId, currentUserRole, otherPartyName, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/chat/booking/${bookingId}`);
      setMessages((res.chat?.messages ?? []) as Message[]);
      // Mark as read
      api.patch(`/chat/booking/${bookingId}/read`).catch(() => {});
    } catch { /* ignore */ }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    fetchMessages(false);
    pollRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    try {
      setSending(true);
      setText('');
      const res = await api.post(`/chat/booking/${bookingId}/messages`, { text: trimmed });
      setMessages(prev => [...prev, res.message as Message]);
    } catch {
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const formatDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  // Group messages by day
  const grouped: { day: string; msgs: Message[] }[] = [];
  messages.forEach(m => {
    const day = formatDay(m.createdAt);
    if (!grouped.length || grouped[grouped.length - 1].day !== day) {
      grouped.push({ day, msgs: [] });
    }
    grouped[grouped.length - 1].msgs.push(m);
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl flex flex-col shadow-2xl"
        style={{ height: '90dvh', maxHeight: '640px' }}>
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-4 sm:rounded-t-2xl flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MessageCircle className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold line-clamp-2 break-words">{otherPartyName}</p>
              <p className="text-xs opacity-75 capitalize">
                {currentUserRole === 'customer' ? 'Your assigned worker' : 'Your customer'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground">Say hello to {otherPartyName}!</p>
            </div>
          ) : (
            grouped.map(({ day, msgs }) => (
              <div key={day}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground px-2 bg-white">{day}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {msgs.map((m, idx) => {
                  const isMine = m.sender._id === currentUserId || m.senderRole === currentUserRole;
                  const prevSame = idx > 0 && msgs[idx - 1].senderRole === m.senderRole;
                  return (
                    <div key={m._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${prevSame ? 'mt-0.5' : 'mt-3'}`}>
                      <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}>
                        {!prevSame && !isMine && (
                          <p className="text-xs font-semibold opacity-60 mb-0.5">{m.sender.name}</p>
                        )}
                        <p className="break-words">{m.text}</p>
                        <p className={`text-[10px] mt-1 text-right ${isMine ? 'opacity-60' : 'text-muted-foreground'}`}>
                          {formatTime(m.createdAt)}
                          {isMine && m.readBy.length > 1 && <span className="ml-1">✓✓</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border bg-white sm:rounded-b-2xl shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 px-3 py-2.5 border border-border rounded-xl text-sm resize-none focus:outline-none focus:border-primary max-h-28"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
