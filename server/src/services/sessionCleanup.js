export async function removeUserSessions(sessionStore, userId) {
  if (!sessionStore?.collectionP) return;
  const sessions = await sessionStore.collectionP;
  const id = String(userId);
  await sessions.deleteMany({ $or: [{ 'session.userId': id }, { session: { $regex: `"userId":"${id}"` } }] });
}
