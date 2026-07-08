export function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(normalizeApiDate(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateValue(value?: string | null): number {
  const date = parseApiDate(value);
  return date ? date.getTime() : 0;
}

export function formatBeijingDateTime(value?: string | null, fallback = '暂无'): string {
  const date = parseApiDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export function beijingDateKey(value?: string | null): string {
  const date = parseApiDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function normalizeApiDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const hasTimezone = /(z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasTimezone) return trimmed;

  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}Z`;
  }

  return trimmed;
}
