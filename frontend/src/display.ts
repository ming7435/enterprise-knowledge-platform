import type { User, WorkspaceMember } from './types';

interface DisplayIdentity {
  username?: string | null;
  nickname?: string | null;
  email?: string | null;
}

export function maskEmail(email?: string | null): string {
  if (!email) return '未知用户';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email.length > 4 ? `${email.slice(0, 3)}***` : '***';
  const head = name.slice(0, Math.min(3, name.length));
  return `${head}***@${domain}`;
}

export function getDisplayName(identity?: DisplayIdentity | null): string {
  const username = identity?.username?.trim();
  if (username) return username;
  const nickname = identity?.nickname?.trim();
  if (nickname) return nickname;
  return maskEmail(identity?.email);
}

export function getMemberDisplayName(member?: WorkspaceMember | null): string {
  return getDisplayName(member);
}

export function getActorName(
  userId: string | null | undefined,
  members: WorkspaceMember[],
  fallback?: User | null
): string {
  if (!userId) return '系统';
  const member = members.find((item) => item.user_id === userId);
  if (member) return getMemberDisplayName(member);
  if (fallback?.id === userId) return getDisplayName(fallback);
  return '未知用户';
}

export function shortId(id?: string | null): string {
  if (!id) return '暂无';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
