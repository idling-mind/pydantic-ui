import type {
  Schema,
  UIConfig,
  DataResponse,
  UpdateResponse,
  ValidationResponse,
} from './types';

// Get the base URL from the current location
function getBaseUrl(): string {
  const { pathname } = window.location;
  // Remove trailing slash and index.html if present
  let base = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  return base;
}

function createFetchJson(apiBase: string) {
  return async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    // If apiBase starts with /, use it as-is, otherwise combine with current path
    const fullUrl = apiBase.startsWith('http') 
      ? `${apiBase}${url.replace('/api', '')}`
      : `${getBaseUrl()}${url}`;
    
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };
}

export interface ActionResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

export function createApiClient(apiBase: string = '/api') {
  const fetchJson = createFetchJson(apiBase);
  
  return {
    getSchema: (): Promise<Schema> => fetchJson<Schema>('/api/schema'),

    getConfig: (): Promise<UIConfig> => fetchJson<UIConfig>('/api/config'),

    getData: (): Promise<DataResponse> => fetchJson<DataResponse>('/api/data'),

    updateData: (data: Record<string, unknown>): Promise<UpdateResponse> =>
      fetchJson<UpdateResponse>('/api/data', {
        method: 'POST',
        body: JSON.stringify({ data }),
      }),

    partialUpdate: (path: string, value: unknown): Promise<UpdateResponse> =>
      fetchJson<UpdateResponse>('/api/data', {
        method: 'PATCH',
        body: JSON.stringify({ path, value }),
      }),

    validateData: (data: Record<string, unknown>): Promise<ValidationResponse> =>
      fetchJson<ValidationResponse>('/api/validate', {
        method: 'POST',
        body: JSON.stringify({ data }),
      }),

    // Trigger a custom action
    triggerAction: (actionId: string, data: Record<string, unknown>): Promise<ActionResponse> =>
      fetchJson<ActionResponse>(`/api/actions/${actionId}`, {
        method: 'POST',
        body: JSON.stringify({ data }),
      }),

    // Respond to a confirmation dialog
    respondToConfirmation: (confirmationId: string, confirmed: boolean): Promise<{ ok: boolean }> =>
      fetchJson<{ ok: boolean }>(`/api/confirmation/${confirmationId}`, {
        method: 'POST',
        body: JSON.stringify({ confirmed }),
      }),
  };
}

// Default export for backwards compatibility
export const api = createApiClient();
