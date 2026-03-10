import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { helpAPI } from '@/lib/api';
import {
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    MessageSquare,
    RefreshCw,
    Send,
    Trash2,
    User
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface HelpMessage {
  _id: string;
  name: string;
  email: string;
  userType: 'customer' | 'worker' | 'guest';
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
}

interface Counts {
  total: number;
  new: number;
  read: number;
  resolved: number;
}

const STATUS_META = {
  new: { label: 'New', badge: 'bg-red-100 text-red-800', icon: Clock },
  read: { label: 'Read', badge: 'bg-amber-100 text-amber-800', icon: Clock },
  resolved: { label: 'Resolved', badge: 'bg-green-100 text-green-800', icon: CheckCircle }
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const AdminHelpMessages = () => {
  const { toast } = useToast();
  const { role } = useAdminRole();

  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, new: 0, read: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await helpAPI.adminGetAll(statusFilter || undefined);
      setMessages(data.messages);
      setCounts(data.counts);
    } catch (error) {
      toast({ title: 'Failed to load help messages', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleExpand = async (msg: HelpMessage) => {
    if (expandedId === msg._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(msg._id);
    if (msg.status === 'new') {
      try {
        await helpAPI.markRead(msg._id);
        setMessages((prev) =>
          prev.map((m) => (m._id === msg._id ? { ...m, status: 'read' } : m))
        );
        setCounts((c) => ({ ...c, new: Math.max(0, c.new - 1), read: c.read + 1 }));
      } catch (_) { /* silent */ }
    }
  };

  const handleReply = async (id: string) => {
    const reply = replyText[id]?.trim();
    if (!reply) return;
    setSubmittingReply(id);
    try {
      await helpAPI.reply(id, reply);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === id
            ? { ...m, status: 'resolved', adminReply: reply, repliedAt: new Date().toISOString() }
            : m
        )
      );
      setCounts((c) => ({
        ...c,
        read: Math.max(0, c.read - 1),
        resolved: c.resolved + 1
      }));
      setReplyText((r) => ({ ...r, [id]: '' }));
      toast({ title: 'Reply sent and message resolved' });
    } catch (error) {
      toast({ title: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setSubmittingReply(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this message permanently?')) return;
    setDeletingId(id);
    try {
      await helpAPI.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
      setCounts((c) => ({ ...c, total: Math.max(0, c.total - 1) }));
      toast({ title: 'Message deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete message', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout userType={role}>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground mb-1 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Help Messages
            </h1>
            <p className="text-muted-foreground text-sm">Support messages from customers and workers</p>
          </div>
          <button
            onClick={fetchMessages}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-4 gap-3">
          {(['', 'new', 'read', 'resolved'] as const).map((s) => {
            const count = s === '' ? counts.total : counts[s];
            const label = s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`card-elevated p-3 text-center transition-all ${active ? 'ring-2 ring-primary' : ''}`}
              >
                <p className="text-xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </button>
            );
          })}
        </div>

        {/* Message list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No messages found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const meta = STATUS_META[msg.status];
              const StatusIcon = meta.icon;
              const isOpen = expandedId === msg._id;

              return (
                <div
                  key={msg._id}
                  className={`card-elevated overflow-hidden ${msg.status === 'new' ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  {/* Summary row */}
                  <button
                    onClick={() => handleExpand(msg)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{msg.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{msg.userType}</span>
                        <Badge className={`text-xs px-2 py-0.5 ${meta.badge}`}>
                          <StatusIcon className="w-3 h-3 mr-1 inline-block" />
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground font-medium truncate">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(msg.createdAt)}</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                      {/* User info */}
                      <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
                        <span>📧 {msg.email}</span>
                        <span className="capitalize">👤 {msg.userType}</span>
                      </div>

                      {/* Message */}
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                      </div>

                      {/* Existing reply */}
                      {msg.adminReply && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-700 mb-1">Your reply:</p>
                          <p className="text-sm text-green-800 whitespace-pre-wrap">{msg.adminReply}</p>
                          {msg.repliedAt && (
                            <p className="text-xs text-green-600 mt-1">{fmtDate(msg.repliedAt)}</p>
                          )}
                        </div>
                      )}

                      {/* Reply form */}
                      {msg.status !== 'resolved' && (
                        <div className="space-y-2">
                          <textarea
                            value={replyText[msg._id] || ''}
                            onChange={(e) =>
                              setReplyText((r) => ({ ...r, [msg._id]: e.target.value }))
                            }
                            placeholder="Type your reply…"
                            rows={3}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                          />
                          <button
                            onClick={() => handleReply(msg._id)}
                            disabled={submittingReply === msg._id || !replyText[msg._id]?.trim()}
                            className="btn-brand py-2 px-4 flex items-center gap-2 text-sm disabled:opacity-60"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {submittingReply === msg._id ? 'Sending…' : 'Reply & Resolve'}
                          </button>
                        </div>
                      )}

                      {/* Delete */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDelete(msg._id)}
                          disabled={deletingId === msg._id}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminHelpMessages;
