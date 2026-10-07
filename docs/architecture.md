# Architecture

This is a separate application from Agent Pipeline. Its dependencies and Node 24 runtime are deliberately independent of Agent Pipeline's zero-dependency Node 18 contract.

```text
React UI -> loopback HTTP -> application services -> domain rules
                                  |
                                  +-> repository port -> SQLite
                                  +-> agent discovery port -> installed CLI paths
                                  +-> market-data port -> future Angel One/5paisa
                                  +-> execution port -> future paper/live adapters
```

`src/shared` defines serialized API contracts. `backend/domain` validates core values without framework or database imports. `backend/application` defines use cases and dependency interfaces. `backend/infrastructure` implements storage and external adapters. `backend/http.ts` handles transport, and `server.ts` composes implementations. The frontend only calls the HTTP API.

The foundation stores watchlist membership, workspace preferences, notifications and audit events. Migrations start with schema version 1; later migrations must run transactionally and support the existing version. Financial settings use paise and basis points. The database is authoritative, with unique exchange/symbol constraints. Imports are validated before entering an atomic transaction.

The core model must later distinguish watchlist entries, strategy candidates, plan versions, order intents, broker orders, fills and positions. Account kind (paper/live) and instrument type are explicit. Derivative instrument metadata and execution/margin models are added before enabling F&O; they are not approximated as stock trades.

Broker adapters will expose capabilities and normalized instruments, historical bars and current quotes. Provider tokens are not canonical instrument IDs. Security-sensitive broker operations belong in adapters, never AI prompts. AI interprets scoped evidence and returns validated proposals; deterministic services own sizing, reservations, limits and execution.

The HTTP API listens only on loopback and checks Host and Origin. Write operations require an unpredictable process-session token fetched by the frontend from bootstrap. This protects against arbitrary websites issuing local mutations; it is not a multiuser identity system. Credential encryption, provider invocation restrictions, backup/restore and desktop packaging remain future work.

Notification history persists independently of future delivery preferences. Preferences currently configure future delivery behavior; no Windows delivery is advertised. The local engine requires the computer to remain running for later monitoring.
