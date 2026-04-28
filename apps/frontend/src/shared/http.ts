import type { ApiError, ErrorCode } from '@bmad-todo/shared';

export type { ApiError, ErrorCode };

export class HttpApiError extends Error {
  readonly apiError: ApiError;
  readonly status: number;
  constructor(apiError: ApiError, status: number) {
    super(apiError.message);
    this.name = 'HttpApiError';
    this.apiError = apiError;
    this.status = status;
  }
}

export async function httpRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    // Network failure: map to INTERNAL_ERROR per architecture line 664
    throw new HttpApiError({ code: 'INTERNAL_ERROR', message: 'Network request failed' }, 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new HttpApiError(
      { code: 'INTERNAL_ERROR', message: 'Invalid JSON in response' },
      response.status,
    );
  }

  if (!response.ok) {
    // Expected envelope: { error: { code, message, details? } }
    const envelope = body as { error?: ApiError };
    const apiError: ApiError = envelope?.error ?? {
      code: 'INTERNAL_ERROR',
      message: 'Unknown error',
    };
    throw new HttpApiError(apiError, response.status);
  }

  return body as T;
}
