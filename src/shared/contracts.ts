export type EntryMode = 'manual' | 'auto';
export interface Settings {
  entryMode: EntryMode;
  entriesPaused: boolean;
  paperCapitalPaise: number | null;
  riskPerTradeBps: number | null;
  notifications: { inApp: boolean; desktop: boolean; sound: boolean };
}
export interface Stock {
  id: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  name: string;
  source: string;
  stage: 'waiting-for-data';
  createdAt: string;
}
export interface Notification {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
}
export interface AgentStatus {
  provider: 'codex' | 'claude' | 'cursor';
  detected: boolean;
  executable: string | null;
  authentication: 'not-checked';
}
export interface Snapshot {
  settings: Settings;
  stocks: Stock[];
  notifications: Notification[];
  agents: AgentStatus[];
  broker: { provider: 'angelone'; status: 'not-connected' };
}
