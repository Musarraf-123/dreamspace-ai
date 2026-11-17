import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { api } from './lib/api.js';

export default function PasswordReset({ token, onDone, notify }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (password.length < 10) return setError('Use at least 10 characters for your password.');
    if (!/[a-z]/i.test(password)) return setError('Include at least one letter in your password.');
    if (!/[0-9]/.test(password)) return setError('Include at least one number in your password.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setWorking(true);
    try {
      const result = await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
      notify(result.message || 'Your password has been updated.');
    } catch (cause) { setError(cause.message || 'Your password could not be updated.'); }
    finally { setWorking(false); }
  };

  return <div className="auth-backdrop"><section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
    <button className="auth-close" onClick={onDone} aria-label="Close" disabled={working}><X size={19} /></button>
    <div className="auth-kicker">SECURE YOUR ACCOUNT</div>
    <h2 id="reset-title">{done ? 'Password updated.' : 'Choose a new password.'}</h2>
    <p>{done ? 'You can now log in with your new password.' : 'This link is valid for 30 minutes and can only be used once.'}</p>
    {done ? <button className="ds-button ds-button-dark auth-submit" onClick={onDone}><Check size={15} /> Go to log in</button> : <form onSubmit={submit}>
      <label>New password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters, with a number" disabled={working} /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Type it again" disabled={working} /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="submit" className="ds-button ds-button-dark auth-submit" disabled={working}>{working ? 'Updating…' : <>Save new password <ArrowRight size={15} /></>}</button>
    </form>}
    <small className="auth-note"><ShieldCheck size={12} /> All other signed-in sessions will be signed out.</small>
  </section></div>;
}
