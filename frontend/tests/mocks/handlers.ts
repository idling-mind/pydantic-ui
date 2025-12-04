/**
 * MSW request handlers for mocking API endpoints
 */

import { http, HttpResponse } from 'msw';

// Default mock data
export const mockSchema = {
  name: 'TestModel',
  type: 'object',
  description: 'A test model',
  fields: {
    name: {
      type: 'string',
      python_type: 'str',
      title: 'Name',
      description: 'The name field',
      required: true,
      default: null,
      constraints: {},
      ui_config: null,
    },
    age: {
      type: 'integer',
      python_type: 'int',
      title: 'Age',
      description: 'Age in years',
      required: false,
      default: 0,
      constraints: {
        minimum: 0,
        maximum: 150,
      },
      ui_config: null,
    },
    active: {
      type: 'boolean',
      python_type: 'bool',
      title: 'Active',
      description: 'Whether active',
      required: true,
      default: true,
      constraints: {},
      ui_config: null,
    },
    tags: {
      type: 'array',
      python_type: 'list[str]',
      title: 'Tags',
      description: 'List of tags',
      required: true,
      items: {
        type: 'string',
        title: 'Item',
      },
    },
  },
};

export const mockConfig = {
  title: 'Test Editor',
  description: 'A test configuration editor',
  theme: 'system',
  read_only: false,
  show_validation: true,
  auto_save: false,
  auto_save_delay: 1000,
  collapsible_tree: true,
  show_types: true,
  actions: [],
  show_save_reset: true,
};

export const mockData = {
  name: 'John Doe',
  age: 30,
  active: true,
  tags: ['developer', 'tester'],
};

// API handlers
export const handlers = [
  // GET /api/schema
  http.get('*/api/schema', () => {
    return HttpResponse.json(mockSchema);
  }),

  // GET /api/config
  http.get('*/api/config', () => {
    return HttpResponse.json(mockConfig);
  }),

  // GET /api/data
  http.get('*/api/data', () => {
    return HttpResponse.json({ data: mockData });
  }),

  // POST /api/data
  http.post('*/api/data', async ({ request }) => {
    const body = await request.json() as { data: Record<string, unknown> };
    return HttpResponse.json({
      data: body.data,
      valid: true,
    });
  }),

  // PATCH /api/data
  http.patch('*/api/data', async ({ request }) => {
    const body = await request.json() as { path: string; value: unknown };
    // Simple path update simulation
    const newData = { ...mockData, [body.path]: body.value };
    return HttpResponse.json({
      data: newData,
      valid: true,
    });
  }),

  // POST /api/validate
  http.post('*/api/validate', async ({ request }) => {
    const body = await request.json() as { data: Record<string, unknown> };
    // Simple validation - check if name exists
    const valid = typeof body.data.name === 'string' && body.data.name.length > 0;
    return HttpResponse.json({
      valid,
      errors: valid ? [] : [
        {
          path: 'name',
          message: 'Name is required',
          type: 'missing',
        },
      ],
    });
  }),

  // GET /api/session
  http.get('*/api/session', () => {
    return HttpResponse.json({ session_id: 'test-session-id' });
  }),

  // POST /api/actions/:actionId
  http.post('*/api/actions/:actionId', async ({ params }) => {
    const { actionId } = params;
    return HttpResponse.json({
      success: true,
      result: { action: actionId, executed: true },
    });
  }),

  // POST /api/confirmation/:confirmationId
  http.post('*/api/confirmation/:confirmationId', async ({ request }) => {
    const body = await request.json() as { confirmed: boolean };
    return HttpResponse.json({ ok: true, confirmed: body.confirmed });
  }),

  // GET /api/events (SSE - return empty for tests)
  http.get('*/api/events', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  }),

  // GET /api/events/poll
  http.get('*/api/events/poll', () => {
    return HttpResponse.json({ events: [] });
  }),
];
