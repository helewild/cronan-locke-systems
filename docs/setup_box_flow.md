# Setup Box Flow

This flow provisions a new tenant from an in-world setup box.

## HTTP endpoint

- `POST /api/v1/portal`
- action: `register_tenant_box`

## Required payload

- `action`
- `setup_secret`
- `buyer_avatar_name`
- `buyer_avatar_key`

## Optional payload

- `tenant_name`
- `bank_name`
- `primary_region_name`
- `payroll_default_amount`
- `marketplace_order_id`

## Response

- `tenant_id`
- `activation_code`
- `license_id`
- `admin_url`

## Buyer flow

1. Buyer purchases product.
2. Buyer rezzes setup box.
3. Buyer touches setup box as owner.
4. Setup box calls `register_tenant_box`.
5. API creates tenant, license, branch, and region.
6. Setup box receives activation code.
7. Buyer opens the admin site and uses `First-Time Setup`.

## Security

- The setup box sends `setup_secret`.
- The VPS validates the secret before provisioning a tenant.
- Rotate the secret if a setup object leaks.
