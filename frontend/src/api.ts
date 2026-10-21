export async function api<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; code?: string } & T;
  if (!response.ok) {
    const error = new Error(payload.error ?? payload.message ?? 'The request could not be completed.') as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

export const jsonBody = (body: unknown): string => JSON.stringify(body);

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
