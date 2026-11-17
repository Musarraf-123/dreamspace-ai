import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import { api } from './lib/api.js';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'enquiries', label: 'Enquiries' },
  { id: 'feedback', label: 'Feedback' },
];
const enquiryStatuses = ['new', 'contacted', 'closed'];
const feedbackStatuses = ['new', 'reviewed', 'closed'];
const dateText = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdminDashboard({ notify }) {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    api('/admin/stats').then((result) => setStats(result.data)).catch((cause) => setError(cause.message));
  }, []);

  useEffect(() => {
    if (tab === 'overview') return;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (tab === 'users' && query) params.set('q', query);
    if (tab !== 'users' && status) params.set('status', status);
    api(`/admin/${tab}?${params}`)
      .then((result) => { setRows(result.data || []); setMeta({ page: result.page, pages: result.pages, total: result.total }); })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [tab, page, query, status]);

  const switchTab = (next) => {
    setTab(next); setPage(1); setRows([]); setStatus('');
    if (next !== 'users') { setQuery(''); setSearch(''); }
  };

  const changeRole = async (user, role) => {
    setBusyId(user.id); setError('');
    try {
      await api(`/admin/users/${user.id}/role`, { method: 'PATCH', body: { role } });
      setRows((current) => current.map((item) => item.id === user.id ? { ...item, role } : item));
      notify(`${user.name} is now ${role === 'admin' ? 'an administrator' : 'a standard user'}.`);
    } catch (cause) { setError(cause.message); }
    finally { setBusyId(''); }
  };

  const changeStatus = async (kind, row, value) => {
    setBusyId(row.id); setError('');
    try {
      await api(`/admin/${kind}/${row.id}`, { method: 'PATCH', body: { status: value } });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: value } : item));
      notify('Status updated.');
    } catch (cause) { setError(cause.message); }
    finally { setBusyId(''); }
  };

  return <div className="admin-layout">
    <div className="admin-head">
      <div className="filter-tabs">{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'filter-active' : ''} onClick={() => switchTab(item.id)}>{item.label}</button>)}</div>
      <span className="admin-badge"><ShieldCheck size={14} /> Administrator view</span>
    </div>
    {error && <div className="projects-inline-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}

    {tab === 'overview' && (stats ? <section className="admin-stats">
      {[
        ['Total users', stats.users, `${stats.newUsers} joined this week`],
        ['Saved projects', stats.projects, `${stats.designs} AI images generated`],
        ['Contractor enquiries', stats.enquiries, `${stats.openEnquiries} awaiting follow-up`],
        ['Feedback entries', stats.feedback, `${stats.newFeedback} new to review`],
      ].map(([label, value, note]) => <article className="admin-stat-card" key={label}><span>{label}</span><b>{value}</b><small>{note}</small></article>)}
    </section> : <p className="notifications-empty">Loading platform stats…</p>)}

    {tab !== 'overview' && <>
      <div className="admin-toolbar">
        {tab === 'users' ? <form className="projects-search" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}><Search size={15} /><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" /><button type="submit">Search</button></form>
          : <div className="admin-status-filter"><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All</option>{(tab === 'enquiries' ? enquiryStatuses : feedbackStatuses).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>}
        <span>{meta.total} result{meta.total === 1 ? '' : 's'}</span>
        <div className="admin-pagination"><button aria-label="Previous page" disabled={meta.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button><span>{meta.page} / {meta.pages}</span><button aria-label="Next page" disabled={meta.page >= meta.pages} onClick={() => setPage((current) => current + 1)}><ChevronRight size={15} /></button></div>
      </div>
      {loading ? <p className="notifications-empty"><LoaderCircle className="project-spin" size={15} /> Loading…</p> : <div className="admin-table-wrap">
        {tab === 'users' && <table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Sign-in</th><th>Joined</th><th>Role</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.name}</b><small>{row.city}</small></td><td>{row.email}</td><td>{row.authProvider === 'google' ? 'Google' : 'Email'}</td><td>{dateText(row.createdAt)}</td><td><select value={row.role} disabled={busyId === row.id} onChange={(event) => changeRole(row, event.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></td></tr>)}</tbody></table>}
        {tab === 'enquiries' && <table className="admin-table"><thead><tr><th>Contact</th><th>Project</th><th>Message</th><th>Received</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.name}</b><small>{row.phone} · {row.city}</small><small>{row.user?.email || 'Guest enquiry'}</small></td><td>{row.project?.title || '—'}</td><td className="admin-message">{row.message}</td><td>{dateText(row.createdAt)}</td><td><select value={row.status} disabled={busyId === row.id} onChange={(event) => changeStatus('enquiries', row, event.target.value)}>{enquiryStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></td></tr>)}</tbody></table>}
        {tab === 'feedback' && <div className="admin-feedback-list">{rows.map((row) => <article key={row.id}><header><div><b>{row.user?.name || 'DreamSpace user'}</b><small>{row.user?.email} · {dateText(row.createdAt)}</small></div><span className="admin-stars">{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</span><select value={row.status} disabled={busyId === row.id} onChange={(event) => changeStatus('feedback', row, event.target.value)}>{feedbackStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></header><p>{row.message}</p><small className="admin-category">{row.category}</small></article>)}</div>}
        {!rows.length && <p className="notifications-empty">Nothing to show yet.</p>}
      </div>}
    </>}
  </div>;
}
