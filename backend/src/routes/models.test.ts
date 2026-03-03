import { describe, test, expect, afterEach } from 'bun:test';
import app from '../hono-app';
import { huggingFaceService } from '../services/huggingface';
import { mockServiceMethod } from '../test/helpers';

describe('Models Routes', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  describe('GET /api/models/search', () => {
    test('returns 400 when q param is missing', async () => {
      const res = await app.request('/api/models/search');
      expect(res.status).toBe(400);
    });

    test('returns 400 when q param is too short', async () => {
      const res = await app.request('/api/models/search?q=a');
      expect(res.status).toBe(400);
    });

    test('returns search results for valid query', async () => {
      const mockResults = {
        models: [{ id: 'meta-llama/Llama-3.1-8B', name: 'Llama 3.1 8B' }],
        total: 1,
      };
      restore = mockServiceMethod(
        huggingFaceService,
        'searchModels',
        async () => mockResults,
      );

      const res = await app.request('/api/models/search?q=llama');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.models).toBeDefined();
      expect(data.models).toHaveLength(1);
      expect(data.models[0].id).toBe('meta-llama/Llama-3.1-8B');
      expect(data.total).toBe(1);
    });

    test('passes limit and offset to service', async () => {
      let capturedParams: any;
      restore = mockServiceMethod(
        huggingFaceService,
        'searchModels',
        async (params: any) => {
          capturedParams = params;
          return { models: [], total: 0 };
        },
      );

      const res = await app.request('/api/models/search?q=llama&limit=5&offset=10');
      expect(res.status).toBe(200);
      expect(capturedParams).toEqual({ query: 'llama', limit: 5, offset: 10 });
    });

    test('returns 500 when service throws', async () => {
      restore = mockServiceMethod(
        huggingFaceService,
        'searchModels',
        async () => { throw new Error('HF API error'); },
      );

      const res = await app.request('/api/models/search?q=llama');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/models/:modelId/gguf-files', () => {
    test('returns gguf files for a model', async () => {
      const mockFiles = ['model-q4_0.gguf', 'model-q8_0.gguf'];
      restore = mockServiceMethod(
        huggingFaceService,
        'getGgufFiles',
        async () => mockFiles,
      );

      const res = await app.request('/api/models/Qwen/Qwen3-0.6B/gguf-files');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.files).toBeDefined();
      expect(Array.isArray(data.files)).toBe(true);
      expect(data.files).toHaveLength(2);
    });

    test('returns 500 when service throws', async () => {
      restore = mockServiceMethod(
        huggingFaceService,
        'getGgufFiles',
        async () => { throw new Error('Model not found'); },
      );

      const res = await app.request('/api/models/unknown/model/gguf-files');
      expect(res.status).toBe(500);
    });
  });
});
