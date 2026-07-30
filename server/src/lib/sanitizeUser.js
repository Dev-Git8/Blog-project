// The single public shape of a user. Email is intentionally omitted — it is
// never exposed through the API, not even to the account's owner's profile
// payload, because no screen needs it.
export function sanitizeUser(user) {
  if (!user) return null
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    createdAt: user.createdAt,
  }
}
