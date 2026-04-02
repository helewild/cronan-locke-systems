# Google Sheets Schema

Use one workbook for the temporary live phase.

## Tabs

### `tenants`

- `tenant_id`
- `name`
- `bank_name`
- `status`
- `owner_avatar_name`
- `owner_username`
- `activation_code`
- `created_at`

### `users`

- `user_id`
- `tenant_id`
- `username`
- `password_hash`
- `role`
- `avatar_name`
- `status`
- `session_token`
- `session_expires_at`
- `must_reset_password`

### `licenses`

- `license_id`
- `tenant_id`
- `buyer_avatar_name`
- `buyer_avatar_key`
- `marketplace_order_id`
- `status`
- `issued_at`

### `accounts`

- `account_id`
- `tenant_id`
- `player_id`
- `customer_name`
- `balance`
- `cash_on_hand`
- `outstanding_fine`
- `loan_balance`
- `status`

### `cards`

- `card_id`
- `account_id`
- `card_number`
- `state`

### `fines`

- `fine_id`
- `account_id`
- `amount`
- `reference`
- `status`

### `loans`

- `loan_id`
- `account_id`
- `balance`
- `terms`
- `status`

### `vault_incidents`

- `incident_id`
- `tenant_id`
- `vault_id`
- `state`
- `stage`
- `actor_name`
- `responding_unit`
- `marked_cash_flag`
- `last_update`

### `audit_logs`

- `audit_id`
- `tenant_id`
- `object_type`
- `object_id`
- `actor_name`
- `target_account_id`
- `action`
- `status`
- `amount`
- `memo`
- `created_at`

### `atms`

- `atm_id`
- `tenant_id`
- `branch_name`
- `status`
- `scope`

## Minimum Live-While-Waiting Requirement

At minimum, the temporary site should have:

- `tenants`
- `users`
- `accounts`
- `vault_incidents`
- `audit_logs`

The rest can be added in phases.
