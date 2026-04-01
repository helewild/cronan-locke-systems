# Local Workflow

## Recommended Loop

1. Write or update scripts locally in this workspace.
2. Keep each object in its own module folder under `scripts/`.
3. Paste the script into Second Life for compile and live behavior testing.
4. Capture compiler errors, chat output, dialog behavior, and edge cases.
5. Iterate locally before the next in-world paste.

## Naming Convention

- Object scripts: `<object>_mock.lsl` while still in fake-data mode
- Shared templates: `shared_<purpose>.lsl`
- Later live-ready versions can become `<object>_core.lsl` or split across multiple scripts

## Script Design Rules

- One script should own one clear role whenever possible.
- Keep tenant, region, branch, and object identity in explicit config variables.
- Keep UI/menu logic separate from response/data logic.
- Put future backend hook points into dedicated helper functions.
- Prefer chat output that reads like receipts, alerts, or terminal messages for RP clarity.

## Suggested Build Order

1. ATM
2. Teller terminal
3. Bank card
4. HUD or phone
5. Vault and robbery

## Future Live Migration Plan

When backend work begins later:

- Keep object menus and local permissions in LSL.
- Replace mock response helpers with HTTP request/response handlers.
- Move balances, transfers, audit history, fines, loans, and freezes off-script.
- Keep object config values compatible with tenant-aware routing.
