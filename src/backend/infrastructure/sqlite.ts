import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { Notification, Settings, Stock } from '../../shared/contracts.js';
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type StockInput,
} from '../domain/model.js';
import type { WorkspaceRepository } from '../application/ports.js';

export class SqliteWorkspace implements WorkspaceRepository {
  private readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(
      'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
    );
    this.db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stocks(id TEXT PRIMARY KEY, symbol TEXT NOT NULL, exchange TEXT NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(exchange, symbol));
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, message TEXT NOT NULL, created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_versions VALUES (1);
      COMMIT;`);
    this.db
      .prepare('INSERT OR IGNORE INTO settings VALUES (1, ?)')
      .run(JSON.stringify(DEFAULT_SETTINGS));
  }
  settings(): Settings {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE id = 1')
      .get()!;
    return validateSettings(JSON.parse(String(row.value)));
  }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private event(kind: string, payload: unknown, message: string) {
    const time = new Date().toISOString();
    this.db
      .prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?)')
      .run(randomUUID(), kind, JSON.stringify(payload), time);
    this.db
      .prepare(
        'INSERT INTO notifications(id, message, created_at) VALUES (?, ?, ?)',
      )
      .run(randomUUID(), message, time);
  }
  saveSettings(settings: Settings) {
    this.transaction(() => {
      this.db
        .prepare('UPDATE settings SET value = ? WHERE id = 1')
        .run(JSON.stringify(settings));
      this.event(
        'settings.updated',
        settings,
        'Paper trading settings updated.',
      );
    });
  }
  stocks(): Stock[] {
    return this.db
      .prepare('SELECT * FROM stocks ORDER BY created_at DESC, symbol')
      .all()
      .map((row) => ({
        id: String(row.id),
        symbol: String(row.symbol),
        exchange: String(row.exchange) as Stock['exchange'],
        name: String(row.name),
        source: String(row.source),
        stage: 'waiting-for-data',
        createdAt: String(row.created_at),
      }));
  }
  importStocks(stocks: StockInput[], source: string) {
    return this.transaction(() => {
      const statement = this.db.prepare(
        'INSERT OR IGNORE INTO stocks VALUES (?, ?, ?, ?, ?, ?)',
      );
      let added = 0;
      for (const stock of stocks)
        added += Number(
          statement.run(
            randomUUID(),
            stock.symbol,
            stock.exchange,
            stock.name,
            source,
            new Date().toISOString(),
          ).changes,
        );
      const skipped = stocks.length - added;
      this.event(
        'watchlist.imported',
        { source, added, skipped },
        `${added} stock(s) added; ${skipped} duplicate(s) skipped.`,
      );
      return { added, skipped };
    });
  }
  notifications(): Notification[] {
    return this.db
      .prepare(
        'SELECT * FROM notifications ORDER BY created_at DESC, rowid DESC LIMIT 100',
      )
      .all()
      .map((row) => ({
        id: String(row.id),
        message: String(row.message),
        createdAt: String(row.created_at),
        read: Boolean(row.is_read),
      }));
  }
  markRead(id: string) {
    return (
      Number(
        this.db
          .prepare('UPDATE notifications SET is_read = 1 WHERE id = ?')
          .run(id).changes,
      ) > 0
    );
  }
  close() {
    this.db.close();
  }
}
