import { describe, test, expect, afterEach } from 'bun:test';
import app from '../hono-app';
import { kubernetesService } from '../services/kubernetes';
import { helmService } from '../services/helm';
import { mockServiceMethod } from '../test/helpers';
import { mockInferenceProviderConfig } from '../test/fixtures';

describe('Installation Provider Routes', () => {
  const restores: Array<() => void> = [];

  afterEach(() => {
    restores.forEach((r) => r());
    restores.length = 0;
  });

  // ==========================================================================
  // GET /api/installation/providers/:providerId/status
  // ==========================================================================

  describe('GET /api/installation/providers/:providerId/status', () => {
    test('returns provider status when found', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => mockInferenceProviderConfig),
      );

      const res = await app.request('/api/installation/providers/kaito/status');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.providerId).toBe('kaito');
      expect(data.providerName).toBe('Kaito');
      expect(data.installed).toBe(true);
      expect(data.installationSteps).toBeDefined();
      expect(data.helmCommands).toBeDefined();
    });

    test('returns 404 for unknown provider', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => null),
      );

      const res = await app.request('/api/installation/providers/unknown/status');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // GET /api/installation/providers/:providerId/commands
  // ==========================================================================

  describe('GET /api/installation/providers/:providerId/commands', () => {
    test('returns commands when provider found', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => mockInferenceProviderConfig),
      );

      const res = await app.request('/api/installation/providers/kaito/commands');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.providerId).toBe('kaito');
      expect(data.providerName).toBe('Kaito');
      expect(data.commands).toBeDefined();
      expect(data.steps).toBeDefined();
    });

    test('returns 404 for unknown provider', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => null),
      );

      const res = await app.request('/api/installation/providers/unknown/commands');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/installation/providers/:providerId/install
  // ==========================================================================

  describe('POST /api/installation/providers/:providerId/install', () => {
    test('returns 404 for unknown provider', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => null),
      );

      const res = await app.request('/api/installation/providers/unknown/install', { method: 'POST' });
      expect(res.status).toBe(404);
    });

    test('returns 400 when helm is not available', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => mockInferenceProviderConfig),
        mockServiceMethod(helmService, 'checkHelmAvailable', async () => ({ available: false, error: 'not found' })),
      );

      const res = await app.request('/api/installation/providers/kaito/install', { method: 'POST' });
      expect(res.status).toBe(400);
    });

    test('returns 200 on successful install', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => mockInferenceProviderConfig),
        mockServiceMethod(helmService, 'checkHelmAvailable', async () => ({ available: true, version: '3.14.0' })),
        mockServiceMethod(helmService, 'installProvider', async () => ({
          success: true,
          results: [{ step: 'install', result: { success: true, stdout: 'ok', stderr: '' } }],
        })),
      );

      const res = await app.request('/api/installation/providers/kaito/install', { method: 'POST' });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results).toBeDefined();
    });
  });

  // ==========================================================================
  // POST /api/installation/providers/:providerId/uninstall
  // ==========================================================================

  describe('POST /api/installation/providers/:providerId/uninstall', () => {
    test('returns 404 for unknown provider', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => null),
      );

      const res = await app.request('/api/installation/providers/unknown/uninstall', { method: 'POST' });
      expect(res.status).toBe(404);
    });

    test('returns 200 on successful uninstall', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => mockInferenceProviderConfig),
        mockServiceMethod(helmService, 'checkHelmAvailable', async () => ({ available: true, version: '3.14.0' })),
        mockServiceMethod(helmService, 'uninstall', async () => ({ success: true, stdout: 'ok', stderr: '' })),
      );

      const res = await app.request('/api/installation/providers/kaito/uninstall', { method: 'POST' });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // ==========================================================================
  // POST /api/installation/providers/:providerId/uninstall-crds
  // ==========================================================================

  describe('POST /api/installation/providers/:providerId/uninstall-crds', () => {
    test('returns 404 for unknown provider', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => null),
      );

      const res = await app.request('/api/installation/providers/unknown/uninstall-crds', { method: 'POST' });
      expect(res.status).toBe(404);
    });

    test('returns 200 on successful CRD removal', async () => {
      restores.push(
        mockServiceMethod(kubernetesService, 'getInferenceProviderConfig', async () => mockInferenceProviderConfig),
        mockServiceMethod(kubernetesService, 'deleteInferenceProviderConfig', async () => undefined),
      );

      const res = await app.request('/api/installation/providers/kaito/uninstall-crds', { method: 'POST' });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
