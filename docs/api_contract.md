# Future Backend Contract

This is the recommended first backend contract for moving the current mock object suite onto a VPS later.

## Design Goal

Keep LSL thin.

LSL should send requests and render responses.
The backend should own the actual banking state.

## Transport Direction

Recommended future transport:

- LSL `llHTTPRequest`
- JSON request and response payloads
- one tenant-aware API base URL

Suggested base route:

- `/api/v1`

## Authentication Direction

For the first backend version, each object should have:

- tenant ID
- object ID
- object type
- shared API token or signed secret

Later you can replace this with stronger per-object keys or signed request validation.

## Common Request Envelope

Every object request should send:

```json
{
  "tenant_id": "demo-tenant",
  "region_id": "demo-region",
  "branch_id": "main-branch",
  "object_id": "atm-001",
  "object_type": "atm",
  "actor_avatar_id": "uuid",
  "actor_name": "Xander Evergarden",
  "session_id": "generated-session-id",
  "action": "balance_view",
  "payload": {}
}
```

## Common Response Envelope

Every backend response should return:

```json
{
  "ok": true,
  "action": "balance_view",
  "message": "Balance retrieved",
  "display": {
    "title": "Balance Inquiry",
    "lines": [
      "Available Balance: L$2845"
    ]
  },
  "data": {},
  "audit_id": "WPB-AUD-30001"
}
```

## General Action Endpoint

For the first implementation pass, the backend may expose a generic action route:

- `POST /api/v1/actions`

This route can accept the common request envelope and branch on `action`.

That is useful while the object suite is still being migrated from mock mode because it lets the LSL scripts keep one request pattern while the backend surface is still evolving.

## ATM Endpoints

Recommended ATM actions:

- `balance_view`
- `withdraw_request`
- `deposit_request`
- `transfer_request`
- `statement_request`

Recommended payload shapes:

```json
{
  "account_id": "WPB-ACCT-10001"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "amount": 500
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "target_name": "Avery Stone",
  "target_account_id": null,
  "amount": 150
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "count": 10
}
```

## Teller Endpoints

Recommended teller actions:

- `account_open`
- `account_view`
- `deposit_request`
- `withdraw_request`
- `card_issue`
- `pin_reset`
- `fine_accept`
- `loan_process`
- `account_freeze`

Recommended teller payload examples:

```json
{
  "customer_name": "Avery Stone"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "amount": 500,
  "memo": "Counter deposit"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "new_pin": "4675"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "amount": 500,
  "memo": "Speeding"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "amount": 500,
  "memo": "Loan/3 weeks/75 per week"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "reason": "PD Requested"
}
```

## Card Endpoints

Recommended card actions:

- `card_view`
- `card_lock`
- `card_unlock`
- `card_report_stolen`
- `card_status`

Payload example:

```json
{
  "card_id": "WPB-CARD-20001",
  "account_id": "WPB-ACCT-10001"
}
```

## HUD Endpoints

Recommended HUD actions:

- `balance_view`
- `transfer_request`
- `history_view`
- `fine_list`
- `fine_pay`
- `loan_view`
- `card_status`

Payload examples:

```json
{
  "account_id": "WPB-ACCT-10001"
}
```

```json
{
  "account_id": "WPB-ACCT-10001",
  "target_name": "Avery Stone",
  "amount": 150
}
```

## Vault Endpoints

Recommended vault actions:

- `vault_arm`
- `vault_breach_start`
- `vault_status`
- `vault_lockdown`
- `vault_reset`
- `vault_cash_collect`

Payload examples:

```json
{
  "vault_id": "vault-001"
}
```

```json
{
  "vault_id": "vault-001",
  "incident_id": "WPB-VLT-40001"
}
```

```json
{
  "vault_id": "vault-001",
  "incident_id": "WPB-VLT-40001",
  "marked_cash_amount": 2500
}
```

## Recommended Backend Models

Minimum first models:

- tenants
- regions
- branches
- players
- accounts
- cards
- transactions
- fines
- loans
- freezes
- audit_logs
- vault_incidents

## Audit Log Shape

Every successful and failed action should create an audit log entry like:

```json
{
  "audit_id": "WPB-AUD-30001",
  "tenant_id": "demo-tenant",
  "region_id": "demo-region",
  "branch_id": "main-branch",
  "object_id": "teller-001",
  "object_type": "teller",
  "actor_avatar_id": "uuid",
  "actor_name": "Xander Evergarden",
  "target_account_id": "WPB-ACCT-10001",
  "action": "fine_accept",
  "status": "approved",
  "amount": 500,
  "memo": "Speeding"
}
```

## Error Contract

Recommended response shape for failures:

```json
{
  "ok": false,
  "action": "withdraw_request",
  "message": "Insufficient funds",
  "error_code": "INSUFFICIENT_FUNDS",
  "display": {
    "title": "Withdrawal Declined",
    "lines": [
      "Insufficient funds"
    ]
  }
}
```

## Recommended First Implementation Order

When you are ready for a VPS, I would build the backend in this order:

1. tenant, region, branch, player, and account models
2. balance view and statement history
3. transfers, deposits, and withdrawals
4. teller account actions and audit logs
5. card status actions
6. fines and loans
7. vault incidents and security events

## LSL Migration Rule

When converting an object from mock to live:

1. keep the existing menu flow
2. replace mock data helpers with API request calls
3. convert receipt builders to render backend responses
4. keep fallback mock mode behind a config flag until stable
