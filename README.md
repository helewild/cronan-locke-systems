# Cronan & Locke Systems

Monorepo for the Cronan & Locke Systems Second Life RP banking platform.

## What Lives Here

- `lsl/` in-world LSL object scripts
- `services/api/` future backend service
- `apps/admin/` future web admin panel
- `packages/contracts/` shared API and event contracts
- `docs/` architecture, workflows, and planning docs
- `ops/` deployment and infrastructure notes
- `assets/` local design and Blender assets
- `sandbox/` experiments and side projects

## Current Status

Working mock-mode object shells exist for:

- ATM
- Teller terminal
- Bank card
- HUD/mobile banking
- Vault and robbery
- Security terminal

Current demo tenant and in-world branding:

- Whispering Pines Bank

Current source files:

- `lsl/scripts/atm/atm_mock.lsl`
- `lsl/scripts/teller/teller_mock.lsl`
- `lsl/scripts/card/card_mock.lsl`
- `lsl/scripts/hud/hud_mock.lsl`
- `lsl/scripts/vault/vault_mock.lsl`
- `lsl/scripts/security/security_terminal_mock.lsl`

## Build Rule

- Build SL object shells first
- Keep LSL as the frontend
- Keep real money logic out of LSL
- Use mock mode until backend work begins
- Preserve menu flow and UX so backend migration is a swap, not a rewrite

## Key Docs

- `docs/architecture.md`
- `docs/api_contract.md`
- `docs/event_schema.md`
- `docs/workflow.md`
- `docs/atm_test_checklist.md`

## Repo Direction

This repo is set up as a single home for:

- LSL object code
- backend planning and implementation
- admin website planning and implementation
- contracts and shared schemas
- infrastructure notes

Platform brand:

- `Cronan & Locke Systems`

Current example tenant:

- `Whispering Pines`

## Suggested Next Milestones

1. Normalize mock IDs and receipt formatting across all objects
2. Wire vault and security terminal to a shared incident model
3. Expand the API scaffold into real persistence and auth
4. Expand the admin scaffold into tenant and incident management pages
5. Connect objects to live API endpoints when hosting is ready
