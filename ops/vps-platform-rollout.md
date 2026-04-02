# VPS Platform Admin Rollout

Use this when deploying the platform-admin slice to the live OVH server.

## Files to sync

- `index.html`
- `site.js`
- `services/api/src/routes/portal.js`
- `services/api/scripts/seed-platform-admin.mjs`

## Server-side steps

1. Sync the updated web files into `/srv/cronan-locke/site/`.
2. Sync the updated API files into `/srv/cronan-locke/api/`.
3. On the server, from `/srv/cronan-locke/api`, run:

```bash
npm install
node scripts/seed-platform-admin.mjs
sudo systemctl restart cronan-locke-api
sudo systemctl reload caddy
```

## Result

The live site will support:

- `platform_admin` login
- platform tenant list view
- create tenant
- edit tenant settings
- suspend/reactivate tenant

Default seeded operator credentials:

- username: `platformadmin`
- password: `demo123`

Change the password after first live verification.
