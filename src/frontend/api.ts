import type { Snapshot } from '../shared/contracts';

let token = '';
export async function loadWorkspace(): Promise<Snapshot> {
  const response = await fetch('/api/bootstrap');
  if (!response.ok)
    throw new Error('Cannot reach the local TradePilot backend.');
  const data = (await response.json()) as { token: string; snapshot: Snapshot };
  token = data.token;
  return data.snapshot;
}
export async function changeWorkspace(
  path: string,
  method: 'POST' | 'PUT',
  body?: unknown,
): Promise<void> {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-TradePilot-Token': token,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || 'Request failed.');
  }
}
