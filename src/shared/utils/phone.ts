export function toE164US(input: string): string | null {
  const d = (input || '').replace(/\D/g, ''); // keep digits only
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null; // not a valid US number
}
