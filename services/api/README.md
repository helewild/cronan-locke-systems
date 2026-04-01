# Cronan & Locke Systems API Service

Placeholder for the future Cronan & Locke Systems backend.

This service will eventually own:

- tenant-aware account data
- balances and statements
- transfers, deposits, and withdrawals
- fines and loans
- card state
- vault incidents
- audit logs
- police/security dispatch events

Start from the contract in `docs/api_contract.md`.

Current scaffold:

- `package.json`
- `.env.example`
- `data/store.json`
- `src/server.js`
- `src/routes/`
- `src/data/store.js`

Current mock endpoints:

- `GET /health`
- `GET /api/v1/dashboard`
- `GET /api/v1/tenant`
- `GET /api/v1/tenants`
- `GET /api/v1/accounts`
- `GET /api/v1/cards`
- `GET /api/v1/incidents`
- `GET /api/v1/audit-logs`
- `POST /api/v1/incidents/action`
