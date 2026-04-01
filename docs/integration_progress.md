# Integration Progress

This document tracks the current gap between the mock LSL object suite and the backend/API.

## Current State

The repo now has:

- working mock LSL objects
- shared API and event contracts
- an admin scaffold
- a JSON-backed API scaffold
- action endpoints for the first customer, card, and incident flows

## Current Action Endpoints

Implemented through `POST /api/v1/actions`:

- `balance_view`
- `deposit_request`
- `withdraw_request`
- `transfer_request`
- `statement_request`
- `history_view`
- `fine_pay`
- `loan_view`
- `card_status`
- `card_lock`
- `card_unlock`
- `card_report_stolen`

Implemented through `POST /api/v1/incidents/action`:

- `incident_acknowledged`
- `incident_dispatched`
- `incident_unit_arrived`
- `incident_resolved`

## What This Means

The backend is now at the point where LSL objects can eventually be upgraded from:

- hardcoded local mock data

to:

- menu flow in LSL
- data and state from the API

## Best Next LSL Integration Order

1. HUD
2. Card
3. ATM
4. Security terminal
5. Vault
6. Teller

Why:

- HUD and card are the simplest first live clients
- ATM already maps well onto the implemented action routes
- security and vault can move after incident routes are stable
- teller should come after write permissions and staff controls are stronger
