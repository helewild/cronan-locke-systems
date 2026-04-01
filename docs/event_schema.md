# Cronan & Locke Systems Event Schema

This document defines the shared event vocabulary for linking in-world objects, backend services, and the future admin panel.

## Purpose

The platform already has working mock objects, but they do not yet share a common live event model.

This schema gives every layer the same language for:

- actions
- incidents
- audit events
- dispatch events
- future object-to-backend requests

## Event Families

### Banking

- `balance_view`
- `withdraw_request`
- `deposit_request`
- `transfer_request`
- `statement_request`
- `history_view`

### Teller

- `account_open`
- `account_view`
- `card_issue`
- `pin_reset`
- `fine_accept`
- `loan_process`
- `account_freeze`

### Card

- `card_view`
- `card_lock`
- `card_unlock`
- `card_report_stolen`
- `card_status`

### Fines and Loans

- `fine_list`
- `fine_pay`
- `loan_view`

### Vault and Security

- `vault_arm`
- `vault_breach_start`
- `vault_breach_tick`
- `vault_opened`
- `vault_lockdown`
- `vault_reset`
- `vault_cash_collect`
- `incident_created`
- `incident_acknowledged`
- `incident_dispatched`
- `incident_unit_arrived`
- `incident_resolved`

## Shared Event Envelope

Recommended normalized event shape:

```json
{
  "event_id": "evt_000001",
  "event_type": "vault_breach_start",
  "tenant_id": "demo-tenant",
  "region_id": "demo-region",
  "branch_id": "main-branch",
  "object_id": "vault-001",
  "object_type": "vault",
  "actor_avatar_id": "uuid",
  "actor_name": "Xander Evergarden",
  "timestamp": "2026-03-31T22:36:00Z",
  "payload": {}
}
```

## Incident Shape

Recommended vault/security incident shape:

```json
{
  "incident_id": "WPB-VLT-40001",
  "tenant_id": "demo-tenant",
  "region_id": "demo-region",
  "branch_id": "main-branch",
  "vault_id": "vault-001",
  "state": "ACTIVE",
  "stage": "BREACH STARTED",
  "actor_name": "Xander Evergarden",
  "responding_unit": "Unit 12",
  "marked_cash_flag": false,
  "last_update": "Silent alert received"
}
```

## Object-to-Backend Mapping

LSL objects should eventually emit backend requests using the same action names defined here.

That means:

- ATM emits banking actions
- Teller emits banking and teller actions
- Card emits card actions
- HUD emits customer banking actions
- Vault emits vault and incident actions
- Security terminal consumes and updates incident actions

## Mock Event Bus Rule

Before the backend exists, any shared mock state should still follow this schema.

Even if the first implementation is only:

- a shared JSON note
- link messages
- a temporary relay object
- a manual admin update

the payload should still match the normalized event structure.

## Recommended Status Values

### Generic

- `PENDING`
- `APPROVED`
- `DECLINED`
- `ACTIVE`
- `RESOLVED`
- `CLOSED`

### Vault

- `SECURE`
- `ARMED`
- `BREACHING`
- `LOCKDOWN`
- `OPENED`

### Incident Stages

- `BREACH STARTED`
- `UNIT DISPATCHED`
- `UNIT ON SCENE`
- `SCENE CLEARED`

## Migration Note

When live backend work begins, this file should become the source of truth for:

- API action naming
- audit event naming
- admin UI incident states
- webhook and notification event names
