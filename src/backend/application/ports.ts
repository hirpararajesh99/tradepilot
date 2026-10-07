import type {
  Notification,
  Settings,
  Stock,
  AgentStatus,
} from '../../shared/contracts.js';
import type { StockInput } from '../domain/model.js';

export interface WorkspaceRepository {
  settings(): Settings;
  saveSettings(settings: Settings): void;
  stocks(): Stock[];
  importStocks(
    stocks: StockInput[],
    source: string,
  ): { added: number; skipped: number };
  notifications(): Notification[];
  markRead(id: string): boolean;
  close(): void;
}
export interface AgentDiscovery {
  list(): AgentStatus[];
}
// Capability-based broker port: credentials stay in the infrastructure implementation.
export interface MarketDataPort {
  readonly provider: string;
  connectionStatus(): Promise<'ready' | 'not-connected' | 'expired'>;
  historicalBars(
    instrumentId: string,
    from: string,
    to: string,
  ): Promise<
    readonly {
      time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[]
  >;
}
// Later adapters must preserve intent identity and distinguish accepted orders from fills.
export interface ExecutionPort {
  readonly mode: 'paper' | 'live';
  submit(intent: {
    id: string;
    accountId: string;
    instrumentId: string;
    quantity: number;
    side: 'buy' | 'sell';
  }): Promise<{ orderId: string; status: 'pending' | 'rejected' }>;
}
