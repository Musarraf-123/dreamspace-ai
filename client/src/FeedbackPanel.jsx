import { useState } from 'react';
import { MessageSquare, Send, Star } from 'lucide-react';
import { api } from './lib/api.js';

const categories = [
  ['general', 'General'],
  ['design', 'AI design'],
  ['estimate', 'Cost estimate'],
  ['bug', 'Something broke'],
  ['idea', 'A new idea'],
];

export default function FeedbackPanel({ notify }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (message.trim().length < 5) return setError('Add a little more detail.');
    setBusy(true);
    try {
      const result = await api('/feedback', { method: 'POST', body: { rating, category, message: message.trim() } });
      setDone(true);
      notify(result.message || 'Thank you for your feedback.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  return <div className="feedback-panel">
    <button className="settings-row" onClick={() => { setOpen((current) => !current); setDone(false); setError(''); }} aria-expanded={open}>
      <MessageSquare size={16} /><span><b>Share feedback</b><small>{open ? 'Close the feedback form' : 'Tell us what to improve'}</small></span>
    </button>
    {open && (done ? <div className="feedback-done"><Star size={17} /><b>Thank you.</b><p>Your feedback has been recorded for the DreamSpace team.</p><button onClick={() => { setDone(false); setMessage(''); }}>Send more feedback</button></div> : <form className="feedback-form" onSubmit={submit}>
      <div className="feedback-stars" role="group" aria-label="Rating">{ [1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= rating ? 'feedback-star active' : 'feedback-star'} aria-label={`${value} star${value > 1 ? 's' : ''}`} onClick={() => setRating(value)}><Star size={17} fill={value <= rating ? 'currentColor' : 'none'} /></button>) }</div>
      <label>Topic<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Your feedback<textarea rows={3} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What worked, what did not, or what should we build next?" required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="ds-button ds-button-dark" disabled={busy}>{busy ? 'Sending…' : <><Send size={14} /> Send feedback</>}</button>
    </form>)}
  </div>;
}
