const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return inr.format(numeric);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return compact.format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(date);
}

export function countdown(target: string | null | undefined): string {
  if (!target) return '';
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return 'MH';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function orderStatusTone(status: string): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'amber';
    case 'PAID':
      return 'sky';
    case 'PROCESSING':
      return 'indigo';
    case 'PARTIALLY_SHIPPED':
    case 'SHIPPED':
      return 'violet';
    case 'PARTIALLY_DELIVERED':
    case 'DELIVERED':
      return 'teal';
    case 'CANCELLED':
      return 'slate';
    default:
      return 'slate';
  }
}

export function paymentStatusTone(status: string): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'teal';
    case 'PENDING':
      return 'amber';
    case 'FAILED':
      return 'rose';
    case 'REFUNDED':
      return 'violet';
    default:
      return 'slate';
  }
}
