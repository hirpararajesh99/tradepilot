import type { Settings, Snapshot } from '../../shared/contracts.js';
import {
  normalizeStock,
  validateSettings,
  ValidationError,
} from '../domain/model.js';
import type { AgentDiscovery, WorkspaceRepository } from './ports.js';

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly agents: AgentDiscovery,
  ) {}
  snapshot(): Snapshot {
    return {
      settings: this.repository.settings(),
      stocks: this.repository.stocks(),
      notifications: this.repository.notifications(),
      agents: this.agents.list(),
      broker: { provider: 'angelone', status: 'not-connected' },
    };
  }
  updateSettings(input: unknown): Settings {
    const settings = validateSettings(input);
    this.repository.saveSettings(settings);
    return settings;
  }
  addStock(input: unknown) {
    return this.repository.importStocks([normalizeStock(input)], 'manual');
  }
  importRows(rows: Record<string, string>[], filename: string) {
    if (!rows.length) throw new ValidationError('CSV has no stock rows.');
    if (rows.length > 5000)
      throw new ValidationError('Import at most 5,000 rows at a time.');
    const stocks = rows.map((row, index) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase(),
          value.trim(),
        ]),
      );
      const raw =
        normalized['nse code'] || normalized.symbol || normalized['nse code,'];
      if (!raw)
        throw new ValidationError(
          `Row ${index + 2}: missing NSE code or symbol.`,
        );
      const cleaned = raw.replace(/^NSE:/i, '').replace(/,+$/, '');
      const alternative = normalized['nse code,']
        ?.replace(/^NSE:/i, '')
        .replace(/,+$/, '');
      if (alternative && alternative.toUpperCase() !== cleaned.toUpperCase())
        throw new ValidationError(
          `Row ${index + 2}: conflicting symbol columns.`,
        );
      return normalizeStock({
        symbol: cleaned,
        name: normalized.name,
        exchange: normalized.exchange || 'NSE',
      });
    });
    return this.repository.importStocks(stocks, filename);
  }
  markRead(id: string) {
    return this.repository.markRead(id);
  }
}
