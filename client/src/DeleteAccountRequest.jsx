import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, LockKeyhole, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { api } from './lib/api.js';
import './delete-account.css';

export default function DeleteAccountRequest() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [googleAccount, setGoogleAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let listener;
    NativeApp.addListener('backButton', () => {
      if (window.history.length > 1) window.history.back();
      else NativeApp.exitApp().catch(() => {});
    }).then((handle) => { listener = handle; }).catch(() => {});
    return () => listener?.remove();
  }, []);

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!email.trim()) return setError('Enter your account email.');
    if (googleAccount && !confirmEmail.trim()) return setError('Type the account email again to confirm.');
    if (!googleAccount && !password) return setError('Enter your account password.');
    if (!window.confirm('Permanently delete your DreamSpace AI account and saved designs? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api('/auth/delete-account-request', {
        method: 'POST',
        body: googleAccount ? { email: email.trim(), confirmEmail: confirmEmail.trim() } : { email: email.trim(), password },
      });
      setPassword(''); setConfirmEmail(''); setComplete(true);
    } catch (cause) { setError(cause.message || 'The deletion request could not be completed.'); }
    finally { setBusy(false); }
  };

  return <main className="delete-account-page"><a className="delete-back" href="/"><ArrowLeft size={16} /> DreamSpace AI</a><section className="delete-account-card"><span className="delete-account-icon">{complete ? <CheckCircle2 size={24} /> : <Trash2 size={24} />}</span><span className="delete-kicker">ACCOUNT AND DATA CONTROL</span><h1>{complete ? 'Your account is deleted.' : 'Delete your account'}</h1>{complete ? <p>Your DreamSpace AI account, saved projects, and stored project images have been removed from the live application database.</p> : <><p>Use the email and password for your account, or the email confirmation for a Google sign-in account. We will verify your credentials and delete the account and associated saved projects and images from DreamSpace AI.</p><form onSubmit={submit}><label htmlFor="deletion-email">Account email</label><input id="deletion-email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /><label className="delete-google-toggle"><input type="checkbox" checked={googleAccount} onChange={(event) => { setGoogleAccount(event.target.checked); setError(''); }} /><span>This account uses Google sign-in</span></label>{googleAccount ? <><label htmlFor="deletion-email-confirm">Type the account email again</label><input id="deletion-email-confirm" type="email" maxLength={254} required value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} /><p className="delete-data-note"><LockKeyhole size={14} /> The email must match the account exactly. No password is stored for Google sign-in accounts.</p></> : <><label htmlFor="deletion-password">Password</label><input id="deletion-password" type="password" autoComplete="current-password" maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /><p className="delete-data-note"><LockKeyhole size={14} /> Your password is used only to verify this deletion request.</p></>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="delete-submit" type="submit" disabled={busy}>{busy ? 'Deleting account…' : 'Permanently delete account'}</button></form></>}<p className="delete-account-footnote">Guest drafts stored only on a device are not part of an account and must be cleared from that device. Provider and backup retention may follow their documented schedules; see the <a href="/privacy.html">privacy notice</a>.</p></section></main>;
}
