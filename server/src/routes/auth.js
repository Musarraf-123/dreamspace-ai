import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Project from '../models/Project.js';
import DesignAsset from '../models/DesignAsset.js';
import PasswordReset from '../models/PasswordReset.js';
import Notification from '../models/Notification.js';
import PlanTask from '../models/PlanTask.js';
import Feedback from '../models/Feedback.js';
import Enquiry from '../models/Enquiry.js';
import requireAuth from '../middleware/requireAuth.js';
import { isAdminEmail } from '../middleware/requireAdmin.js';
import { removeUserSessions } from '../services/sessionCleanup.js';
import { appBaseUrl, mailConfigured, sendMail } from '../services/mailer.js';

const router = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});
const googleLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many Google sign-in attempts. Please wait a few minutes and try again.' },
});
const accountDeleteLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many account deletion attempts. Please try again later.' } });
const profileLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => String(req.user._id), message: { error: 'Too many profile changes. Please try again later.' } });
const passwordResetLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many password reset requests. Please wait 15 minutes and try again.' } });

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80, 'Name must be 80 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(254, 'Email address is too long.'),
  password: z.string().min(10, 'Password must be at least 10 characters.').max(128, 'Password must be 128 characters or fewer.')
    .regex(/[a-z]/i, 'Password must include a letter.').regex(/[0-9]/, 'Password must include a number.'),
  termsAccepted: z.literal(true, 'Accept the Terms of Service to create an account.'),
  privacyAcknowledged: z.literal(true, 'Acknowledge the Privacy Policy to create an account.'),
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254, 'Email address is too long.'),
  password: z.string().min(1, 'Enter your password.').max(128, 'Password is too long.'),
}).strict();
const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  city: z.string().trim().min(2, 'Enter your city.').max(80),
  preferredStyle: z.string().trim().min(2).max(60),
}).strict();

function validationError(error) {
  return error.issues?.[0]?.message || 'Please check the information and try again.';
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}

function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    city: user.city || 'Pune',
    preferredStyle: user.preferredStyle || 'Warm minimal',
    hasPassword: user.authProvider !== 'google',
    isAdmin: user.role === 'admin' || isAdminEmail(user.email),
  };
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export async function verifyGoogleCredential(credential, { fetchImpl = fetch, clientId = process.env.GOOGLE_CLIENT_ID } = {}) {
  if (!clientId) {
    const error = new Error('Google sign-in is not configured on the server.');
    error.status = 503;
    error.publicMessage = 'Google sign-in is not available right now. Use email and password instead.';
    throw error;
  }
  let response;
  try {
    response = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    const error = new Error('Google token verification could not be reached.');
    error.status = 502;
    error.publicMessage = 'Google sign-in could not be verified. Please try again.';
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !GOOGLE_ISSUERS.includes(payload.iss) || payload.aud !== clientId
    || String(payload.email_verified) !== 'true' || !payload.sub || !payload.email) {
    const error = new Error('Google credential rejected.');
    error.status = 401;
    error.publicMessage = 'Google sign-in could not be verified. Please try again.';
    throw error;
  }
  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.email.split('@')[0]).trim().slice(0, 80) || 'DreamSpace user',
  };
}

async function removeAccountData(userId, sessionStore) {
  await Promise.all([
    User.deleteOne({ _id: userId }),
    DesignAsset.deleteMany({ ownerId: userId }),
    Project.deleteMany({ ownerId: userId }),
    PasswordReset.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    PlanTask.deleteMany({ userId }),
    Feedback.deleteMany({ userId }),
    Enquiry.deleteMany({ userId }),
  ]);
  await removeUserSessions(sessionStore, userId);
}

router.post('/signup', authLimit, async (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });
  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  try {
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, termsVersion: 'draft-2026-11', termsAcceptedAt: new Date() });
    await regenerateSession(req);
    req.session.userId = user._id.toString();
    await saveSession(req);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
    return next(error);
  }
});

router.post('/login', authLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });
  try {
    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    const passwordMatches = user?.passwordHash ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'This account uses Google sign-in. Continue with Google instead.' });
    if (!passwordMatches) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await regenerateSession(req);
    req.session.userId = user._id.toString();
    await saveSession(req);
    return res.json({ user: publicUser(user) });
  } catch (error) { return next(error); }
});

router.post('/google', googleLimit, async (req, res, next) => {
  const parsed = z.object({ credential: z.string().trim().min(20).max(6000) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'The Google sign-in response was incomplete. Please try again.' });
  try {
    const profile = await verifyGoogleCredential(parsed.data.credential);
    let user = await User.findOne({ email: profile.email });
    if (!user) {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        authProvider: 'google',
        termsVersion: 'draft-2026-11',
        termsAcceptedAt: new Date(),
      });
    } else if (!user.googleId) {
      user.googleId = profile.googleId;
      await user.save();
    }
    await regenerateSession(req);
    req.session.userId = user._id.toString();
    await saveSession(req);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'This Google account is already linked to another DreamSpace account.' });
    return next(error);
  }
});

router.post('/forgot-password', passwordResetLimit, async (req, res, next) => {
  const parsed = z.object({ email: z.string().trim().email('Enter a valid email address.').max(254) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });
  const genericMessage = 'If an account with that email exists, a password reset link has been sent.';
  try {
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.passwordHash) return res.json({ message: genericMessage });
    const token = randomBytes(32).toString('hex');
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
    const resetUrl = `${appBaseUrl()}/?reset=${token}`;
    const delivery = await sendMail({
      to: user.email,
      subject: 'Reset your DreamSpace AI password',
      text: `Use this link to choose a new password within 30 minutes: ${resetUrl}\n\nIf you did not ask for this, you can ignore this email.`,
      html: `<p>Use the link below to choose a new DreamSpace AI password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
    });
    const payload = { message: genericMessage };
    if (!delivery.delivered && !mailConfigured() && process.env.NODE_ENV !== 'production') payload.resetUrl = resetUrl;
    return res.json(payload);
  } catch (error) { return next(error); }
});

router.post('/reset-password', passwordResetLimit, async (req, res, next) => {
  const parsed = z.object({
    token: z.string().trim().min(20, 'This reset link is not valid.').max(128),
    password: z.string().min(10, 'Password must be at least 10 characters.').max(128, 'Password must be 128 characters or fewer.')
      .regex(/[a-z]/i, 'Password must include a letter.').regex(/[0-9]/, 'Password must include a number.'),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });
  try {
    const reset = await PasswordReset.findOne({ tokenHash: hashToken(parsed.data.token), usedAt: null, expiresAt: { $gt: new Date() } });
    if (!reset) return res.status(400).json({ error: 'This reset link has expired or was already used. Request a new one.' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.findByIdAndUpdate(reset.userId, { $set: { passwordHash, authProvider: 'email' } }, { new: true });
    if (!user) return res.status(400).json({ error: 'This account is no longer available.' });
    reset.usedAt = new Date();
    await reset.save();
    await PasswordReset.deleteMany({ userId: user._id, _id: { $ne: reset._id } });
    await removeUserSessions(req.app.locals.sessionStore, user._id);
    return res.json({ message: 'Your password has been updated. Log in with your new password.' });
  } catch (error) { return next(error); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch('/profile', requireAuth, profileLimit, async (req, res, next) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: parsed.data }, { new: true, runValidators: true });
    if (!user) return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    return res.json({ user: publicUser(user) });
  } catch (error) { return next(error); }
});

router.delete('/account', requireAuth, accountDeleteLimit, async (req, res, next) => {
  const parsed = z.object({
    password: z.string().min(1).max(128).optional(),
    confirmEmail: z.string().trim().email('Type your account email to confirm.').max(254).optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confirm this deletion with your password or account email.' });
  try {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) return res.status(401).json({ error: 'Your account was not found. Please sign in again.' });
    const usesGoogle = user.authProvider === 'google' || !user.passwordHash;
    if (usesGoogle) {
      if (!parsed.data.confirmEmail || parsed.data.confirmEmail.toLowerCase() !== user.email) {
        return res.status(401).json({ error: 'Type the account email exactly to confirm deletion. Your account has not been deleted.' });
      }
    } else if (!parsed.data.password || !await bcrypt.compare(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ error: 'Password is incorrect. Your account has not been deleted.' });
    }
    await removeAccountData(user._id, req.app.locals.sessionStore);
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie('dreamspace.sid', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase(), path: '/' });
    return res.json({ message: 'Your account and saved project data have been deleted.' });
  } catch (error) { return next(error); }
});

router.post('/delete-account-request', accountDeleteLimit, async (req, res, next) => {
  const parsed = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128).optional(),
    confirmEmail: z.string().trim().max(254).optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter the email address and password (or type the email again for a Google account).' });
  try {
    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) return res.status(401).json({ error: 'The email or verification details are incorrect. No account data was deleted.' });
    const usesGoogle = user.authProvider === 'google' || !user.passwordHash;
    if (usesGoogle) {
      if (!parsed.data.confirmEmail || parsed.data.confirmEmail.toLowerCase() !== email) {
        return res.status(401).json({ error: 'Type the account email again to confirm. No account data was deleted.' });
      }
    } else if (!parsed.data.password || !await bcrypt.compare(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ error: 'The email or password is incorrect. No account data was deleted.' });
    }
    await removeAccountData(user._id, req.app.locals.sessionStore);
    return res.json({ message: 'Your DreamSpace AI account and saved project data have been deleted.' });
  } catch (error) { return next(error); }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.json({ message: 'You are signed out.' });
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('dreamspace.sid', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase(), path: '/' });
    return res.json({ message: 'You are signed out.' });
  });
});

export default router;
