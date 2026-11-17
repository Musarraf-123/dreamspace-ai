import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ClipboardCheck, ListChecks, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { api } from './lib/api.js';

const phases = [
  { id: 'planning', label: 'Planning', hint: 'Scope, budget and measurements' },
  { id: 'design', label: 'Design', hint: 'Layouts, finishes and materials' },
  { id: 'procurement', label: 'Procurement', hint: 'Quotes, orders and delivery' },
  { id: 'execution', label: 'Execution', hint: 'Site work and supervision' },
  { id: 'handover', label: 'Handover', hint: 'Snag list and final checks' },
];

export default function Planner({ user, setAuth, projects, notify }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', phase: 'planning', projectId: '', dueDate: '' });

  const load = async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { const result = await api('/planner'); setTasks(result.data || []); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);

  const grouped = useMemo(() => phases.map((phase) => ({ ...phase, tasks: tasks.filter((task) => task.phase === phase.id) })), [tasks]);
  const doneCount = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const projectName = (id) => projects.find((project) => (project._id || project.id) === id)?.title;

  const addTask = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return setError('Enter a task name.');
    setBusy(true); setError('');
    try {
      const result = await api('/planner', { method: 'POST', body: {
        title: form.title.trim(), phase: form.phase,
        projectId: form.projectId || undefined,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T09:00:00`).toISOString() : undefined,
      } });
      setTasks((current) => [...current, result.data]);
      setForm({ title: '', phase: form.phase, projectId: form.projectId, dueDate: '' });
      notify('Task added to your renovation plan.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const startTemplate = async () => {
    setBusy(true); setError('');
    try {
      const result = await api('/planner/template', { method: 'POST', body: {} });
      setTasks(result.data || []);
      notify(result.added ? `${result.added} planning tasks added.` : 'Your checklist is already up to date.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const toggle = async (task) => {
    setError('');
    try {
      const result = await api(`/planner/${task._id}`, { method: 'PATCH', body: { done: !task.done } });
      setTasks((current) => current.map((item) => item._id === task._id ? result.data : item));
    } catch (cause) { setError(cause.message); }
  };

  const remove = async (task) => {
    if (!window.confirm(`Remove “${task.title}” from your plan?`)) return;
    try {
      await api(`/planner/${task._id}`, { method: 'DELETE' });
      setTasks((current) => current.filter((item) => item._id !== task._id));
    } catch (cause) { setError(cause.message); }
  };

  if (!user) return <div className="planner-guest">
    <span><ClipboardCheck size={24} /></span>
    <h3>Your renovation, step by step</h3>
    <p>Create a free account to keep a shared checklist for planning, design, purchases, site work and handover.</p>
    <button className="ds-button ds-button-dark" onClick={() => setAuth('signup')}>Create a free account</button>
  </div>;

  return <div className="planner-layout">
    <section className="planner-main">
      <div className="planner-progress-card">
        <div><span className="planner-progress-icon"><ListChecks size={18} /></span><div><b>{doneCount} of {tasks.length || 0} steps complete</b><small>{tasks.length ? 'Keep going — a clear plan makes site decisions easier.' : 'Start with our renovation checklist or add your own first step.'}</small></div></div>
        <div className="planner-progress-track"><span style={{ width: `${progress}%` }} /></div>
        <div className="planner-progress-meta"><span>{progress}% planned</span><button onClick={startTemplate} disabled={busy}>{busy ? 'Adding…' : 'Use standard checklist'}</button></div>
      </div>
      {error && <div className="projects-inline-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {loading ? <p className="notifications-empty">Loading your plan…</p> : grouped.map((phase) => <section className="planner-phase" key={phase.id}>
        <header><div><h3>{phase.label}</h3><p>{phase.hint}</p></div><span>{phase.tasks.filter((task) => task.done).length}/{phase.tasks.length}</span></header>
        {phase.tasks.length ? <ul>{phase.tasks.map((task) => <li key={task._id} className={task.done ? 'planner-task planner-task-done' : 'planner-task'}>
          <button className="planner-check" aria-label={task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`} onClick={() => toggle(task)}>{task.done && <Check size={13} />}</button>
          <div><b>{task.title}</b><small>{[projectName(task.projectId), task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''].filter(Boolean).join(' · ') || 'General renovation task'}</small></div>
          <button className="planner-remove" aria-label={`Remove ${task.title}`} onClick={() => remove(task)}><Trash2 size={14} /></button>
        </li>)}</ul> : <p className="planner-phase-empty">Nothing here yet.</p>}
      </section>)}
    </section>
    <aside className="planner-aside">
      <form className="planner-form" onSubmit={addTask}>
        <h3><Plus size={16} /> Add a task</h3>
        <label>Task name<input maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Book a site visit" required /></label>
        <label>Phase<select value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value })}>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.label}</option>)}</select></label>
        <label>Project<select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">General plan</option>{projects.filter((project) => !project.archived).map((project) => <option key={project._id || project.id} value={project._id || project.id}>{project.title}</option>)}</select></label>
        <label>Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
        <button type="submit" className="ds-button ds-button-dark" disabled={busy}>{busy ? <><LoaderCircle className="project-spin" size={14} /> Saving…</> : <><Plus size={14} /> Add task</>}</button>
      </form>
      <div className="planner-note"><CalendarDays size={17} /><div><b>A plan you can share</b><p>Tasks are stored with your account, so you can return to them on any device.</p></div></div>
    </aside>
  </div>;
}
