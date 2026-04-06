# Phone HUD Setup

This is the live in-world mobile banking script:

- [hud_phone_live.lsl](C:/Users/Alex/Documents/New%20project/lsl/scripts/hud/hud_phone_live.lsl)

It connects to the same VPS banking backend already used by:

- [atm_live.lsl](C:/Users/Alex/Documents/New%20project/lsl/scripts/atm/atm_live.lsl)
- [card_live.lsl](C:/Users/Alex/Documents/New%20project/lsl/scripts/card/card_live.lsl)

## What It Can Do

- open a live customer banking session
- show balance and account summary
- show recent transaction history
- transfer funds to another player account in the same tenant
- pay due fines
- pay active loans
- lock, unlock, or report the linked card stolen

## Configuration

The shipped script already contains:

- live `CONFIG_API_URL`
- bootstrap secret

Optional values can stay blank:

```lsl
string CONFIG_TENANT_ID = "";
string CONFIG_DEVICE_ID = "";
```

The first successful session will:

- detect the tenant automatically
- cache the tenant bank name
- cache the tenant-specific object secret

## How To Use In Second Life

1. Create or attach the HUD object.
2. Drop [hud_phone_live.lsl](C:/Users/Alex/Documents/New%20project/lsl/scripts/hud/hud_phone_live.lsl) into the HUD object.
3. Reset the script.
4. Touch the HUD while logged in as a resident who has a bank account in that tenant.

## Requirements

The resident must already have:

- a player/account record
- optional card for card controls
- optional fine for fine payment
- optional loan for loan payment

## Best Matching Live Portal Features

This HUD uses the same live banking actions already exposed through the customer portal:

- `transfer_funds`
- `pay_fine`
- `pay_loan`
- `lock_card`
- `unlock_card`
- `report_stolen_card`
