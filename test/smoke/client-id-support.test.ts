import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { ClientController } from '../../src/controllers/ClientController';
import { resolveClientOrThrow, ClientNotFoundError } from '../../src/services/tenants/resolveClientOrThrow';

type MockResponse = {
  statusCode: number;
  body: any;
  status: (code: number) => MockResponse;
  json: (payload: any) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

test('ensure cria e repete mantendo o mesmo id; conflito retorna 409', async () => {
  const controller = new ClientController();
  const bySlug = new Map<string, { id: string; slug: string; name: string; isActive: boolean }>();

  (controller as any).repo = {
    async upsertBySlug(
      slug: string,
      data: { name: string; apiBaseUrl: string; apiKey: string; isActive: boolean }
    ) {
      if (slug === 'slug-em-conflito') {
        throw { code: 'P2002', meta: { target: ['slug'] } };
      }
      const existing = bySlug.get(slug);
      if (existing) {
        const updated = { ...existing, name: data.name, isActive: data.isActive };
        bySlug.set(slug, updated);
        return updated;
      }

      const created = {
        id: `client_${bySlug.size + 1}`,
        slug,
        name: data.name,
        isActive: data.isActive,
      };
      bySlug.set(slug, created);
      return created;
    },
  };

  const req1 = {
    body: {
      slug: 'corz',
      name: 'Corz',
      apiBaseUrl: 'https://example.test',
      apiKey: 'key-1',
      isActive: true,
    },
  } as any;
  const res1 = createMockResponse();
  await controller.ensure(req1, res1 as any);
  assert.equal(res1.statusCode, 200);
  assert.ok(res1.body?.client?.id);

  const req2 = {
    body: {
      slug: 'corz',
      name: 'Corz 2',
      apiBaseUrl: 'https://example.test',
      apiKey: 'key-2',
      isActive: true,
    },
  } as any;
  const res2 = createMockResponse();
  await controller.ensure(req2, res2 as any);
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.body.client.id, res1.body.client.id);

  const resConflict = createMockResponse();
  await controller.ensure(
    {
      body: {
        slug: 'slug-em-conflito',
        name: 'Corz',
        apiBaseUrl: 'https://example.test',
        apiKey: 'key-x',
        isActive: true,
      },
    } as any,
    resConflict as any
  );
  assert.equal(resConflict.statusCode, 409);
  assert.deepEqual(resConflict.body, { error: 'slug_conflict', message: 'Slug already in use' });
});

test('resolver retorna client_not_found para id/slug inexistentes', async () => {
  await assert.rejects(
    resolveClientOrThrow(
      { clientId: 'inexistente' },
      {
        clientRepository: {
          findById: async () => null,
          findBySlug: async () => null,
        },
      }
    ),
    (error: unknown) => {
      assert.ok(error instanceof ClientNotFoundError);
      assert.equal((error as ClientNotFoundError).code, 'client_not_found');
      return true;
    }
  );
});

test('rotas por id nao conflitam com slug e auth continua ativa', async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'http://localhost:5432/db';
  process.env.IMPORT_START_AT = process.env.IMPORT_START_AT ?? '2026-01-01T00:00:00.000Z';
  process.env.ADMIN_TOKEN = 'token-admin-smoke';
  process.env.DASHBOARD_WRITE_TOKEN = 'token-dashboard-smoke';
  process.env.DASHBOARD_INSECURE_USER_HEADER = process.env.DASHBOARD_INSECURE_USER_HEADER ?? 'true';

  const { AdminDashboardController } = await import('../../src/controllers/AdminDashboardController');
  const { TenantDashboardController } = await import('../../src/controllers/TenantDashboardController');

  (AdminDashboardController.prototype as any).getClientKpisById = async (_req: any, res: any) =>
    res.json({ client: { id: 'same-client-id', slug: 'corz', name: 'Corz' }, routeType: 'id' });
  (AdminDashboardController.prototype as any).getClientKpis = async (_req: any, res: any) =>
    res.json({ client: { id: 'same-client-id', slug: 'corz', name: 'Corz' }, routeType: 'slug' });
  (TenantDashboardController.prototype as any).putUserLayoutById = async (_req: any, res: any) =>
    res.json({ ok: true });

  const routes = (await import('../../src/routes/index')).default;
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api`;

    const idResp = await fetch(`${base}/admin/clients/id/abc123/kpis`, {
      headers: { 'x-admin-token': process.env.ADMIN_TOKEN as string },
    });
    const idPayload = (await idResp.json()) as {
      routeType: string;
      client: { id: string; slug: string; name: string };
    };
    assert.equal(idResp.status, 200);
    assert.equal(idPayload.routeType, 'id');

    const slugResp = await fetch(`${base}/admin/clients/corz/kpis`, {
      headers: { 'x-admin-token': process.env.ADMIN_TOKEN as string },
    });
    const slugPayload = (await slugResp.json()) as {
      routeType: string;
      client: { id: string; slug: string; name: string };
    };
    assert.equal(slugResp.status, 200);
    assert.equal(slugPayload.routeType, 'slug');
    assert.equal(slugPayload.client.id, idPayload.client.id);

    const unauthorizedResp = await fetch(`${base}/admin/clients/id/abc123/kpis`);
    assert.equal(unauthorizedResp.status, 401);

    const forbiddenResp = await fetch(`${base}/tenant/clients/id/abc123/dashboard-layout`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-dashboard-write-token': 'token-invalido',
      },
      body: JSON.stringify({ layout: { version: 1, type: 'ORDER', order: [], hidden: [], configOverrides: {} } }),
    });
    assert.equal(forbiddenResp.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
