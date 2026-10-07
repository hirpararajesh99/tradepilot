import { useEffect, useState, type FormEvent } from 'react';
import type { Settings, Snapshot } from '../shared/contracts';
import { changeWorkspace, loadWorkspace } from './api';

const pages = [
  'Dashboard',
  'Pipeline',
  'Watchlists',
  'Orders & positions',
  'Journal & learning',
  'Notifications',
  'Configuration',
] as const;
type Page = (typeof pages)[number];
const currency = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    paise / 100,
  );

export function App() {
  const [page, setPage] = useState<Page>('Dashboard');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState('NSE');
  const [config, setConfig] = useState('Broker & data');
  const [draft, setDraft] = useState<Settings | null>(null);
  async function refresh() {
    const data = await loadWorkspace();
    setSnapshot(data);
    setDraft(data.settings);
  }
  useEffect(() => {
    let active = true;
    loadWorkspace()
      .then((data) => {
        if (active) {
          setSnapshot(data);
          setDraft(data.settings);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Cannot load workspace.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function mutate(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }
  async function addStock(event: FormEvent) {
    event.preventDefault();
    await mutate(
      () => changeWorkspace('/api/stocks', 'POST', { symbol, exchange }),
      'Stock processed. Existing duplicates are skipped.',
    );
    setSymbol('');
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 900000) {
      setError('Use a CSV smaller than 900 KB.');
      return;
    }
    await mutate(
      async () =>
        changeWorkspace('/api/import', 'POST', {
          filename: file.name,
          csv: await file.text(),
        }),
      'Watchlist imported. Check the inbox for added and skipped counts.',
    );
  }
  const stocks = snapshot?.stocks ?? [];
  const unread = snapshot?.notifications.filter((n) => !n.read).length ?? 0;
  function stockTable() {
    return stocks.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stock</th>
              <th>Exchange</th>
              <th>Stage</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.id}>
                <td>
                  <strong>{stock.symbol}</strong>
                  <small>{stock.name}</small>
                </td>
                <td>{stock.exchange}</td>
                <td>
                  <span className="status">Waiting for data</span>
                </td>
                <td>{stock.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty">
        <h3>Your watchlist starts here</h3>
        <p>Upload your QuanTfy CSV or add a stock symbol.</p>
        <button onClick={() => setPage('Watchlists')}>Open watchlists</button>
      </div>
    );
  }
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="logo">TP</span>
          <div>
            TradePilot<small>Local workspace</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {pages.map((item) => (
            <button
              key={item}
              aria-current={page === item ? 'page' : undefined}
              onClick={() => {
                setPage(item);
                setMessage('');
              }}
            >
              {item}
              {item === 'Notifications' && unread > 0 && (
                <span className="count">{unread}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="badge">PAPER ONLY</span>
          <p>Foundation release · v0.1</p>
        </div>
      </aside>
      <div className="content">
        <header>
          <span>Personal trading workstation</span>
          <button onClick={() => setPage('Notifications')}>
            Inbox {unread > 0 ? `(${unread})` : ''}
          </button>
        </header>
        <main>
          <div className="page-head">
            <div>
              <p className="eyebrow">WORKSPACE / {page.toUpperCase()}</p>
              <h1>{page === 'Dashboard' ? 'Your trading day' : page}</h1>
            </div>
            {snapshot && (
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(
                    () =>
                      changeWorkspace('/api/settings', 'PUT', {
                        ...snapshot.settings,
                        entriesPaused: !snapshot.settings.entriesPaused,
                      }),
                    snapshot.settings.entriesPaused
                      ? 'New-entry preference resumed.'
                      : 'New-entry preference paused.',
                  )
                }
              >
                {snapshot.settings.entriesPaused
                  ? 'Resume new entries'
                  : 'Pause new entries'}
              </button>
            )}
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {!snapshot && !error && <p role="status">Loading local workspace…</p>}
          {page === 'Dashboard' && snapshot && (
            <>
              <div className="stats">
                <article>
                  <p>Paper capital</p>
                  <h2>
                    {snapshot.settings.paperCapitalPaise === null
                      ? 'Not configured'
                      : currency(snapshot.settings.paperCapitalPaise)}
                  </h2>
                  <small>Starting capital · no fills yet</small>
                </article>
                <article>
                  <p>Tracked stocks</p>
                  <h2>{stocks.length}</h2>
                  <small>Awaiting verified market data</small>
                </article>
                <article>
                  <p>Entry preference</p>
                  <h2>
                    {snapshot.settings.entryMode === 'auto' ? 'Auto' : 'Manual'}
                  </h2>
                  <small>
                    {snapshot.settings.entriesPaused
                      ? 'New entries paused'
                      : 'Simulator not enabled yet'}
                  </small>
                </article>
              </div>
              <section className="panel">
                <div className="section-head">
                  <h2>Complete your setup</h2>
                  <span className="status">Angel One · not connected</span>
                </div>
                <p>
                  Configure paper capital and risk limits, add your watchlist,
                  then connect verified market data.
                </p>
                <button onClick={() => setPage('Configuration')}>
                  Open configuration
                </button>
              </section>
              <section className="panel">
                <div className="section-head">
                  <h2>Watchlist progress</h2>
                  <button className="quiet" onClick={() => setPage('Pipeline')}>
                    View pipeline →
                  </button>
                </div>
                {stockTable()}
              </section>
            </>
          )}
          {page === 'Pipeline' && (
            <section className="panel">
              <h2>Stock stages</h2>
              <p>
                Imported stocks wait for historical candles before analysis can
                start.
              </p>
              {stockTable()}
              <p className="muted">
                Future stages: analyzing → watching setup → plan ready → risk
                checked → paper order pending.
              </p>
            </section>
          )}
          {page === 'Watchlists' && (
            <>
              <section className="panel">
                <h2>Add stocks</h2>
                <form
                  onSubmit={(event) => void addStock(event)}
                  className="inline-form"
                >
                  <label>
                    Symbol
                    <input
                      value={symbol}
                      onChange={(event) => setSymbol(event.target.value)}
                      placeholder="e.g. SUNTV"
                      required
                      maxLength={40}
                    />
                  </label>
                  <label>
                    Exchange
                    <select
                      value={exchange}
                      onChange={(event) => setExchange(event.target.value)}
                    >
                      <option>NSE</option>
                      <option>BSE</option>
                    </select>
                  </label>
                  <button disabled={busy || !snapshot} type="submit">
                    Add stock
                  </button>
                </form>
                <label className="upload">
                  Import watchlist CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={busy || !snapshot}
                    onChange={(event) => {
                      void upload(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </label>
                <p className="muted">
                  Supports QuanTfy “NSE code” or generic “symbol” columns.
                  Conflicting symbols and malformed rows reject the complete
                  import.
                </p>
              </section>
              <section className="panel">{stockTable()}</section>
            </>
          )}
          {(page === 'Orders & positions' || page === 'Journal & learning') && (
            <section className="panel empty">
              <h2>
                {page === 'Orders & positions'
                  ? 'No paper orders or positions'
                  : 'No trade reviews yet'}
              </h2>
              <p>
                {page === 'Orders & positions'
                  ? 'The execution ledger and paper simulator are the next trading milestone.'
                  : 'Filled trades will retain their plans, exits, costs, and reviewed lessons.'}
              </p>
              <span className="status">No live order capability</span>
            </section>
          )}
          {page === 'Notifications' && (
            <section className="panel">
              <h2>Workspace inbox</h2>
              {!snapshot?.notifications.length && (
                <p>No events yet. Imports and settings changes appear here.</p>
              )}
              {snapshot?.notifications.map((n) => (
                <div className="inbox-row" key={n.id}>
                  <div>
                    <strong>{n.message}</strong>
                    <small>
                      {new Date(n.createdAt).toLocaleString('en-IN')}
                    </small>
                  </div>
                  {n.read ? (
                    <span className="muted">Read</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          () =>
                            changeWorkspace(
                              `/api/notifications/${n.id}/read`,
                              'POST',
                            ),
                          'Notification marked read.',
                        )
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
          {page === 'Configuration' && draft && (
            <>
              <div className="tabs">
                {[
                  'Broker & data',
                  'AI agents',
                  'Strategy & risk',
                  'Notifications',
                ].map((item) => (
                  <button
                    key={item}
                    aria-pressed={config === item}
                    onClick={() => setConfig(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <section className="panel">
                {config === 'Broker & data' && (
                  <>
                    <h2>Angel One</h2>
                    <span className="status">Not connected</span>
                    <p>
                      The first market-data adapter will connect through this
                      screen. Secure credential storage and supported sign-in
                      are pending implementation.
                    </p>
                    <p className="muted">
                      5paisa and additional brokers will use the same
                      application interfaces.
                    </p>
                  </>
                )}
                {config === 'AI agents' && (
                  <>
                    <h2>Installed providers</h2>
                    <p>
                      Executable detection is available. Authentication and
                      agent invocation are the next integration step.
                    </p>
                    {snapshot?.agents.map((agent) => (
                      <div className="inbox-row" key={agent.provider}>
                        <div>
                          <strong>{agent.provider}</strong>
                          <small>
                            {agent.executable || 'Not found on PATH'}
                          </small>
                        </div>
                        <span className="status">
                          {agent.detected
                            ? 'Detected · login unchecked'
                            : 'Not detected'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {config === 'Strategy & risk' && (
                  <>
                    <h2>Paper account preferences</h2>
                    <div className="settings-grid">
                      <label>
                        Entry mode
                        <select
                          value={draft.entryMode}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              entryMode: e.target
                                .value as Settings['entryMode'],
                            })
                          }
                        >
                          <option value="manual">
                            Manual — review entries
                          </option>
                          <option value="auto">
                            Auto — approved strategy triggers
                          </option>
                        </select>
                      </label>
                      <label>
                        Starting capital (₹)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={
                            draft.paperCapitalPaise === null
                              ? ''
                              : draft.paperCapitalPaise / 100
                          }
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              paperCapitalPaise:
                                e.target.value === ''
                                  ? null
                                  : Math.round(Number(e.target.value) * 100),
                            })
                          }
                        />
                      </label>
                      <label>
                        Risk per trade (%)
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={
                            draft.riskPerTradeBps === null
                              ? ''
                              : draft.riskPerTradeBps / 100
                          }
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              riskPerTradeBps:
                                e.target.value === ''
                                  ? null
                                  : Math.round(Number(e.target.value) * 100),
                            })
                          }
                        />
                      </label>
                    </div>
                    <p className="muted">
                      Preferences persist locally. Strategies and the simulator
                      must be implemented before these can produce paper orders.
                    </p>
                  </>
                )}
                {config === 'Notifications' && (
                  <>
                    <h2>Notification preferences</h2>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.notifications.inApp}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            notifications: {
                              ...draft.notifications,
                              inApp: e.target.checked,
                            },
                          })
                        }
                      />
                      In-app notices
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.notifications.desktop}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            notifications: {
                              ...draft.notifications,
                              desktop: e.target.checked,
                            },
                          })
                        }
                      />
                      Desktop notifications when available
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.notifications.sound}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            notifications: {
                              ...draft.notifications,
                              sound: e.target.checked,
                            },
                          })
                        }
                      />
                      Sound when desktop delivery is available
                    </label>
                    <p className="muted">
                      The inbox stores workspace events. Windows desktop
                      delivery is pending implementation; preferences are saved
                      for that integration.
                    </p>
                  </>
                )}
                {(config === 'Strategy & risk' ||
                  config === 'Notifications') && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        () => changeWorkspace('/api/settings', 'PUT', draft),
                        'Preferences saved locally.',
                      )
                    }
                  >
                    Save preferences
                  </button>
                )}
              </section>
            </>
          )}
        </main>
        <footer>
          SQLite workspace · Local system · Market data not connected
        </footer>
      </div>
    </div>
  );
}
