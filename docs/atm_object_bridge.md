# ATM Object Bridge

The live ATM object talks directly to the VPS portal endpoint:

- `http://15.204.56.251/api/v1/portal`

It uses:

- `action: "object_action"`
- `object_type: "atm"`

Supported ATM action types:

- `session`
- `balance`
- `withdraw`
- `deposit`
- `statement`

Required request fields:

- `object_secret`
- `tenant_id`
- `region_id`
- `branch_id`
- `atm_id`
- `avatar_name`
- `avatar_key`

For live use:

1. Open [atm_live.lsl](C:/Users/Alex/Documents/New%20project/lsl/scripts/atm/atm_live.lsl)
2. Set:
   - `CONFIG_API_URL`
   - `CONFIG_OBJECT_SECRET`
   - `CONFIG_TENANT_ID`
   - `CONFIG_REGION_ID`
   - `CONFIG_BRANCH_ID`
   - `CONFIG_ATM_ID`
3. Drop the script into the ATM object
4. Touch the ATM as a resident whose avatar name matches a customer account in that tenant

The object bridge uses the server-side `OBJECT_API_SECRET` if set, or falls back to `SETUP_BOX_SECRET`.
