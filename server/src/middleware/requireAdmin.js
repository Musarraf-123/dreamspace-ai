export function isAdminEmail(email) {
  const configured = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && configured.includes(String(email).toLowerCase());
}

export default function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== 'admin' && !isAdminEmail(req.user.email)) {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  return next();
}
