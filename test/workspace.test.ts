import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { SqliteWorkspace } from '../src/backend/infrastructure/sqlite.js';
import { WorkspaceService } from '../src/backend/application/workspace.js';
import {
  DEFAULT_SETTINGS,
  validateSettings,
} from '../src/backend/domain/model.js';
import { parseCsv } from '../src/backend/infrastructure/csv.js';
import { createAppServer } from '../src/backend/http.js';

const noAgents = { list: () => [] };

test('QuanTfy CSV preserves quoted commas and resolves its two symbol fields', () => {
  const repository = new SqliteWorkspace(':memory:');
  try {
    const service = new WorkspaceService(repository, noAgents);
    const rows = parseCsv(
      'Name,NSE code,"NSE Code,"\r\n"Example, Limited",SUNTV,"NSE:SUNTV,"\r\n',
    );
    assert.deepEqual(service.importRows(rows, 'watchlist.csv'), {
      added: 1,
      skipped: 0,
    });
    assert.equal(repository.stocks()[0]?.name, 'Example, Limited');
    assert.deepEqual(service.importRows(rows, 'watchlist.csv'), {
      added: 0,
      skipped: 1,
    });
    assert.equal(repository.stocks().length, 1);
  } finally {
    repository.close();
  }
});

test('conflicting or invalid rows reject an entire import without partial state', () => {
  const repository = new SqliteWorkspace(':memory:');
  try {
    const service = new WorkspaceService(repository, noAgents);
    assert.throws(
      () =>
        service.importRows(
          [{ symbol: 'SUNTV' }, { symbol: '../../unsafe' }],
          'bad.csv',
        ),
      /valid stock symbol/,
    );
    assert.throws(
      () =>
        service.importRows(
          [{ 'NSE code': 'SUNTV', 'NSE Code,': 'NSE:ALICON,' }],
          'bad.csv',
        ),
      /conflicting/,
    );
    assert.equal(repository.stocks().length, 0);
    assert.equal(repository.notifications().length, 0);
  } finally {
    repository.close();
  }
});

test('CSV rejects broken quotes, duplicate headers and mismatched row widths', () => {
  assert.throws(() => parseCsv('symbol\n"SUNTV'), /unclosed/);
  assert.throws(() => parseCsv('symbol,symbol\nSUNTV,SUNTV'), /duplicate/);
  assert.throws(() => parseCsv('symbol,name\nSUNTV'), /column count/);
  assert.deepEqual(parseCsv('symbol,name\nSUNTV,"Line one\nLine two"'), [
    { symbol: 'SUNTV', name: 'Line one\nLine two' },
  ]);
});

test('paper settings reject unsafe financial amounts and invalid risk limits', () => {
  assert.throws(
    () => validateSettings({ ...DEFAULT_SETTINGS, paperCapitalPaise: 10.5 }),
    /whole paise/,
  );
  assert.throws(
    () => validateSettings({ ...DEFAULT_SETTINGS, riskPerTradeBps: 10001 }),
    /Risk/,
  );
  assert.throws(
    () => validateSettings({ ...DEFAULT_SETTINGS, entryMode: 'live' }),
    /manual or auto/,
  );
  assert.equal(
    validateSettings({ ...DEFAULT_SETTINGS, riskPerTradeBps: null })
      .riskPerTradeBps,
    null,
  );
});

test('SQLite survives reopen and settings/audit notifications remain consistent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tradepilot-test-'));
  const filename = path.join(directory, 'test.sqlite');
  let repository = new SqliteWorkspace(filename);
  try {
    repository.saveSettings({
      ...DEFAULT_SETTINGS,
      paperCapitalPaise: 10000000,
      entryMode: 'auto',
    });
    repository.close();
    repository = new SqliteWorkspace(filename);
    assert.equal(repository.settings().paperCapitalPaise, 10000000);
    assert.equal(repository.settings().entryMode, 'auto');
    const notification = repository.notifications()[0]!;
    assert.equal(repository.markRead(notification.id), true);
    assert.equal(repository.notifications()[0]?.read, true);
    assert.equal(repository.markRead('missing'), false);
  } finally {
    repository.close();
    for (const suffix of ['', '-wal', '-shm']) {
      const target = filename + suffix;
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.rmdirSync(directory);
  }
});

test('HTTP rejects untrusted origins and unauthenticated mutations, accepts local token', async () => {
  const repository = new SqliteWorkspace(':memory:');
  const server = createAppServer(new WorkspaceService(repository, noAgents));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal(
      (
        await fetch(`${base}/api/bootstrap`, {
          headers: { Origin: 'https://untrusted.example' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}/api/stocks`, { method: 'POST', body: '{}' }))
        .status,
      403,
    );
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      token: string;
    };
    const headers = {
      'Content-Type': 'application/json',
      'X-TradePilot-Token': bootstrap.token,
    };
    assert.equal(
      (
        await fetch(`${base}/api/stocks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ symbol: 'SUNTV' }),
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await fetch(`${base}/api/stocks`, {
          method: 'POST',
          headers,
          body: 'not-json',
        })
      ).status,
      400,
    );
    assert.equal(repository.stocks().length, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    repository.close();
  }
});
