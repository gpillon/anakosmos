export const formatAge = (date?: string): string => {
  if (!date) return '—';
  const created = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.max(now - created, 0);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const pluralize = (value: number, label: string) => `${value} ${label}${value === 1 ? '' : 's'}`;
