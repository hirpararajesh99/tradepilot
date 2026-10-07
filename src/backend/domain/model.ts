import type { Settings } from '../../shared/contracts.js';

export class ValidationError extends Error {}
export const DEFAULT_SETTINGS: Settings = {
  entryMode: 'manual',
  entriesPaused: false,
  paperCapitalPaise: null,
  riskPerTradeBps: null,
  notifications: { inApp: true, desktop: false, sound: false },
};
export interface StockInput {
  symbol: string;
  exchange: 'NSE' | 'BSE';
  name: string;
}
export function normalizeStock(input: unknown): StockInput {
  if (!input || typeof input !== 'object')
    throw new ValidationError('Stock must be an object.');
  const value = input as Record<string, unknown>;
  const symbol =
    typeof value.symbol === 'string' ? value.symbol.trim().toUpperCase() : '';
  if (!/^[A-Z0-9][A-Z0-9&_.-]{0,39}$/.test(symbol))
    throw new ValidationError(
      'Enter a valid stock symbol (maximum 40 characters).',
    );
  const exchange = value.exchange ?? 'NSE';
  if (exchange !== 'NSE' && exchange !== 'BSE')
    throw new ValidationError('Exchange must be NSE or BSE.');
  const name = typeof value.name === 'string' ? value.name.trim() : symbol;
  if (name.length > 200) throw new ValidationError('Stock name is too long.');
  return { symbol, exchange, name: name || symbol };
}
export function validateSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object')
    throw new ValidationError('Settings must be an object.');
  const s = input as Record<string, unknown>;
  if (s.entryMode !== 'manual' && s.entryMode !== 'auto')
    throw new ValidationError('Select manual or auto entry mode.');
  if (typeof s.entriesPaused !== 'boolean')
    throw new ValidationError('Invalid entry pause setting.');
  const capital = s.paperCapitalPaise;
  if (
    capital !== null &&
    (typeof capital !== 'number' ||
      !Number.isSafeInteger(capital) ||
      capital <= 0)
  )
    throw new ValidationError(
      'Paper capital must be positive, in whole paise, or unset.',
    );
  const risk = s.riskPerTradeBps;
  if (
    risk !== null &&
    (typeof risk !== 'number' ||
      !Number.isInteger(risk) ||
      risk < 1 ||
      risk > 10000)
  )
    throw new ValidationError('Risk must be between 0.01% and 100%, or unset.');
  if (!s.notifications || typeof s.notifications !== 'object')
    throw new ValidationError('Notification preferences are missing.');
  const n = s.notifications as Record<string, unknown>;
  if (
    typeof n.inApp !== 'boolean' ||
    typeof n.desktop !== 'boolean' ||
    typeof n.sound !== 'boolean'
  )
    throw new ValidationError('Notification preferences must be booleans.');
  return {
    entryMode: s.entryMode,
    entriesPaused: s.entriesPaused,
    paperCapitalPaise: capital as number | null,
    riskPerTradeBps: risk as number | null,
    notifications: { inApp: n.inApp, desktop: n.desktop, sound: n.sound },
  };
}
