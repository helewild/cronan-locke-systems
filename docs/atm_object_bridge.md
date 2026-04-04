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
- `avatar_name`
- `avatar_key`

Optional request fields:

- `tenant_id`
- `region_id`
- `branch_id`
- `atm_id`
- `object_owner_name`
- `object_owner_key`

For live use:

1. Open [atm_live.lsl](C:/Users/Alex/Documents/New%20project/lsl/scripts/atm/atm_live.lsl)
2. The shipped script already contains the live `CONFIG_API_URL` and a bootstrap secret
3. Optional defaults can stay blank:
   - `CONFIG_TENANT_ID`
   - `CONFIG_REGION_ID`
   - `CONFIG_BRANCH_ID`
   - `CONFIG_ATM_ID`
4. Drop the script into the ATM object
5. Touch the ATM as a resident whose avatar name matches a customer account

The live script now detects the tenant automatically on first successful session and caches the resolved tenant and bank branding in the object description.

After the first successful session, the server returns a tenant-scoped object secret and the script switches to that tenant-specific secret automatically.

The object bridge uses the server-side `OBJECT_API_SECRET` if set, or falls back to `SETUP_BOX_SECRET`.
