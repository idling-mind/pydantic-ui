/**
 * Tests for the API client
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApiClient } from '@/api';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('createApiClient', () => {
  const api = createApiClient('/api');

  describe('getSchema', () => {
    it('fetches schema successfully', async () => {
      const schema = await api.getSchema();
      expect(schema).toBeDefined();
      expect(schema.name).toBe('TestModel');
      expect(schema.type).toBe('object');
      expect(schema.fields).toBeDefined();
    });

    it('handles fetch error', async () => {
      server.use(
        http.get('*/api/schema', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(api.getSchema()).rejects.toThrow();
    });
  });

  describe('getConfig', () => {
    it('fetches config successfully', async () => {
      const config = await api.getConfig();
      expect(config).toBeDefined();
      expect(config.title).toBe('Test Editor');
      expect(config.theme).toBe('system');
    });
  });

  describe('getData', () => {
    it('fetches data successfully', async () => {
      const response = await api.getData();
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(response.data.name).toBe('John Doe');
    });
  });

  describe('updateData', () => {
    it('sends POST request with data', async () => {
      const newData = { name: 'Jane Doe', age: 25 };
      const response = await api.updateData(newData);
      expect(response.valid).toBe(true);
      expect(response.data).toEqual(newData);
    });

    it('returns validation errors', async () => {
      server.use(
        http.post('*/api/data', () => {
          return HttpResponse.json({
            data: {},
            valid: false,
            errors: [
              { path: 'name', message: 'Required', type: 'missing' },
            ],
          });
        })
      );

      const response = await api.updateData({});
      expect(response.valid).toBe(false);
      expect(response.errors).toHaveLength(1);
    });
  });

  describe('partialUpdate', () => {
    it('sends PATCH request with path and value', async () => {
      const response = await api.partialUpdate('name', 'Updated Name');
      expect(response.valid).toBe(true);
    });
  });

  describe('validateData', () => {
    it('validates data without saving', async () => {
      const response = await api.validateData({ name: 'Test', age: 30 });
      expect(response.valid).toBe(true);
      expect(response.errors).toHaveLength(0);
    });

    it('returns errors for invalid data', async () => {
      const response = await api.validateData({ name: '', age: 30 });
      expect(response.valid).toBe(false);
    });
  });

  describe('triggerAction', () => {
    it('triggers action with data', async () => {
      const response = await api.triggerAction('validate', { name: 'Test' });
      expect(response.success).toBe(true);
    });
  });

  describe('respondToConfirmation', () => {
    it('sends confirmation response', async () => {
      const response = await api.respondToConfirmation('confirm-123', true);
      expect(response.ok).toBe(true);
    });
  });
});
