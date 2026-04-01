# Cronan & Locke Systems Architecture

This document turns the current mock object set into a shared Cronan & Locke Systems platform pattern that can survive the move to a hosted backend later.

## Current Object Set

- `scripts/atm/atm_mock.lsl`
- `scripts/teller/teller_mock.lsl`
- `scripts/card/card_mock.lsl`
- `scripts/hud/hud_mock.lsl`
- `scripts/vault/vault_mock.lsl`

Current demo tenant:

- `Whispering Pines`

## Core Rule

LSL is the interaction layer.

The object is responsible for:

- menus
- private dialog handling
- local session tracking
- local permission checks
- user prompts
- mock feedback and RP presentation

The future backend will be responsible for:

- accounts
- balances
- cash vs bank split
- transfers
- statements
- fines
- loans
- freezes
- card status
- vault logs and payouts
- audit trails
- tenant-aware persistence

## Shared Pattern

Every object should keep the same top-level structure:

1. constants and config block
2. runtime state variables
3. formatting helpers
4. session/listener helpers
5. menu display helpers
6. action handlers
7. LSL event handlers

This is already visible across the current scripts and should remain the standard.

## Shared Config Fields

Every object should expose these config values where relevant:

- `CONFIG_BANK_NAME`
- `CONFIG_TENANT_ID`
- `CONFIG_REGION_ID`
- `CONFIG_BRANCH_ID` or location equivalent
- object ID such as `CONFIG_ATM_ID`, `CONFIG_TERMINAL_ID`, `CONFIG_CARD_ID`, `CONFIG_DEVICE_ID`, or `CONFIG_VAULT_ID`

Recommended future additions:

- `CONFIG_OBJECT_TYPE`
- `CONFIG_API_BASE`
- `CONFIG_API_TOKEN`
- `CONFIG_ENVIRONMENT`
- `CONFIG_FEATURE_FLAGS`

## Shared Helper Conventions

Recommended helper names:

- `randomPrivateChannel`
- `formatMoney`
- `scopeLabel`
- `headerLine`
- `resetListeners` or `resetListener`
- `clearPendingAction`
- `startSession`
- `endSession`
- `showMainMenu`

This keeps every object readable and makes it easier to copy patterns safely.

## Standard Receipt Style

All user-facing receipts should follow the same shape:

- branded header
- action name
- status
- actor or customer
- account or object reference
- amount if relevant
- scope
- mock/live note

Recommended order:

1. Header
2. Action or receipt type
3. Status
4. Actor and/or customer
5. Account or object reference
6. Amount or state details
7. Scope
8. Mode note

## Standard Scope Format

Keep using:

- `tenant/region/branch`

Example:

- `demo-tenant/demo-region/main-branch`

Later this should also map directly into backend routing and log filtering.

## Account and Card References

Current mock references are derived from avatar keys or names. That is acceptable for UI testing, but should be replaced with cleaner mock IDs and later real backend IDs.

Recommended mock formats:

- account: `WPB-ACCT-10001`
- card: `WPB-CARD-20001`
- teller action: `WPB-AUD-30001`
- vault incident: `WPB-VLT-40001`

Recommended rule:

- never derive long-term IDs from avatar names
- use generated IDs for anything users may see repeatedly

## Linked Object Messaging Plan

When objects in the same linkset need to talk to each other later, use `llMessageLinked` with a shared numeric message map.

Recommended message families:

- `1000-1099` ATM
- `1100-1199` Teller
- `1200-1299` Card
- `1300-1399` HUD
- `1400-1499` Vault
- `1900-1999` Shared/system

Recommended payload style:

- string payload in a simple key-value format
- example: `action=withdraw|account_id=WPB-ACCT-10001|amount=500`

If the platform grows, move to JSON strings for payloads so the same payloads can later be reused in HTTP requests.

## Suggested Shared Event Names

These action names should stay normalized across objects and backend:

- `balance_view`
- `withdraw_request`
- `deposit_request`
- `transfer_request`
- `statement_request`
- `account_open`
- `account_view`
- `card_issue`
- `card_lock`
- `card_unlock`
- `card_report_stolen`
- `pin_reset`
- `fine_accept`
- `fine_pay`
- `loan_process`
- `loan_view`
- `account_freeze`
- `vault_arm`
- `vault_breach_start`
- `vault_lockdown`
- `vault_reset`
- `vault_cash_collect`

## Object Responsibilities

ATM:

- customer self-service
- private session
- low-friction transactional UI

Teller:

- staff-only operations
- target customer workflows
- confirmations and audit-style actions

Card:

- owner-bound card state UI
- lock, unlock, stolen reporting

HUD:

- portable customer banking view
- balances, transfers, fines, loans, card state

Vault:

- robbery and security flow
- alerts, timers, lockdown, marked cash state

## Recommended Next Refactor

Before backend work, the best cleanup pass would be:

1. create a shared constants file or copyable header template
2. normalize object ID and account ID formats
3. normalize receipt wording and field order
4. normalize action names to the shared event list
5. add placeholder backend hook functions in every object

## Placeholder Backend Hook Functions

Each object should eventually include functions shaped like:

- `sendApiRequest(string action, string payload)`
- `handleApiSuccess(string action, string payload)`
- `handleApiError(string action, string payload)`

Even in mock mode, keeping those names reserved will make migration smoother later.
