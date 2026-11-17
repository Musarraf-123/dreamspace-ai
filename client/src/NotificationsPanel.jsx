import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from './lib/api.js';

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export default function NotificationsPanel({ user, onAuth, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);

  const load = async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const result = await api('/notifications');
      setItems(result.data || []);
      setUnread(result.unreadCount || 0);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user) { setItems([]); setUnread(0); return undefined; }
    load();
    const timer = window.setInterval(() => { api('/notifications').then((result) => setUnread(result.unreadCount || 0)).catch(() => {}); }, 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = () => {
    if (!user) return onAuth();
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const markAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (cause) { setError(cause.message); }
  };

  const openItem = (item) => {
    if (!item.read) {
      api(`/notifications/${item._id}/read`, { method: 'PATCH' }).catch(() => {});
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry));
      setUnread((current) => Math.max(0, current - 1));
    }
    setOpen(false);
    if (!item.link) return;
    if (item.link.includes('project=')) return onNavigate('My Projects');
    const params = new URLSearchParams(item.link.replace(/^\/\?/, ''));
    const page = params.get('page');
    if (page) onNavigate(page);
  };

  return <div className="notifications-wrap" ref={wrapRef}>
    <button className="workspace-bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={toggle}>
      <Bell size={18} />
      {unread > 0 && <i className="notif-dot" />}
    </button>
    {open && <div className="notifications-popover" role="dialog" aria-label="Notifications">
      <header><div><b>Notifications</b>{unread > 0 && <span>{unread} new</span>}</div>{items.some((item) => !item.read) && <button onClick={markAll}><CheckCheck size={14} /> Mark all read</button>}</header>
      {error && <p className="notifications-error" role="alert">{error}</p>}
      {loading ? <p className="notifications-empty">Loading your updates…</p> : items.length ? <ul>{items.map((item) => <li key={item._id}><button className={item.read ? 'notification-item' : 'notification-item notification-unread'} onClick={() => openItem(item)}><span className={`notification-icon notification-${item.type}`} /><span><b>{item.title}</b>{item.message && <p>{item.message}</p>}<small>{relativeTime(item.createdAt)}</small></span></button></li>)}</ul> : <p className="notifications-empty">You’re all caught up. New designs and enquiries will appear here.</p>}
    </div>}
  </div>;
}
