export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

export function formatPayoutReason(reason: string | null): string {
  return reason
    ? reason.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : '—';
}
