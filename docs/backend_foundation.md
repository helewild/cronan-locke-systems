# Backend Foundation

This document describes the current backend direction in the repo.

## Current Approach

The API scaffold now uses a simple JSON-backed store so the platform has:

- repeatable entity models
- real route boundaries
- a stable place to add logic
- a low-friction way to test admin views before a database is introduced

## Current Entities

- tenants
- regions
- branches
- players
- accounts
- cards
- transactions
- fines
- loans
- audit_logs
- vault_incidents

## Current API Behavior

The scaffold is still read-mostly, but it now has:

- tenant summary
- tenant list
- account list
- card list
- incident list
- audit log list
- dashboard metrics
- incident action updates

## Why JSON Store First

This is not the final persistence layer.

It is useful now because it lets the repo validate:

- field naming
- object relationships
- admin page data needs
- incident lifecycle behavior
- backend contract assumptions

without forcing an early database or ORM decision.

## Planned Upgrade Path

1. move the JSON store shape into a relational schema
2. add a database layer
3. add auth and tenant-aware access controls
4. add write routes for ATM, teller, HUD, card, and vault events
5. add background jobs, notifications, and incident dispatch automation
