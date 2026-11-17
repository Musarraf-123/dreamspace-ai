import { useState } from 'react';
import { ArrowRight, Check, Mail, ShieldCheck, X } from 'lucide-react';
import { api } from './lib/api.js';

export default function ForgotPassword({ onClose, onSwitch }) {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!email.trim()) return setError('Enter your email address.');
    setWorking(true);
    try { setResult(await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } })); }
    catch (cause) { setError(cause.message || 'The reset link could not be sent.'); }
    finally { setWorking(false); }
  };

  return <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
    <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <button className="auth-close" onClick={onClose} aria-label="Close" disabled={working}><X size={19} /></button>
      <div className="auth-kicker">A WAY BACK IN</div>
      <h2 id="forgot-title">Reset your password.</h2>
      <p>Enter the email on your account. If it matches, we will send a link that lets you choose a new password.</p>
      {result ? <div className="auth-forgot-result"><span><Check size={16} /></span><p>{result.message}</p>{result.resetUrl && <a href={result.resetUrl}>Open your reset link <ArrowRight size={14} /></a>}<button type="button" onClick={() => onSwitch('login')}>Back to log in</button></div> : <form onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={working} /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="ds-button ds-button-dark auth-submit" disabled={working}>{working ? 'Sending…' : <><Mail size={15} /> Send reset link</>}</button>
      </form>}
      <div className="auth-switch">Remembered your password? <button onClick={() => onSwitch('login')} disabled={working}>Log in</button></div>
      <small className="auth-note"><ShieldCheck size={12} /> Reset links expire after 30 minutes.</small>
    </section>
  </div>;
}
