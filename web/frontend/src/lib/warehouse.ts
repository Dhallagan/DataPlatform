export interface WarehouseQueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

export async function runWarehouseQuery(sql: string): Promise<Record<string, unknown>[]> {
  const response = await fetch('/api/reports/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const payload = (await response.json()) as WarehouseQueryPayload;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'Query failed');
  }
  return payload.data;
}

export async function runWarehouseQuerySafe(sql: string): Promise<Record<string, unknown>[]> {
  try {
    return await runWarehouseQuery(sql);
  } catch {
    return [];
  }
}

export function num(value: unknown): number {
  return Number(value ?? 0);
}

export function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}
