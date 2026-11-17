import User from '../models/User.js';

export default async function requireAuth(req, res, next) {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: 'Please log in to continue.' });
    const user = await User.findById(req.session.userId).select('name email city preferredStyle authProvider role').lean();
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    req.user = user;
    return next();
  } catch (error) { return next(error); }
}
