# Cronan & Locke Systems Admin

This app is the web admin foundation for the Cronan & Locke Systems platform.

Current state:

- Next.js app-router setup adapted from the imported template direction
- reads platform data from `../../services/api/data/store.json`
- renders a banking operations dashboard for tenants, accounts, cards, incidents, fines, loans, and audit activity

Local development:

```powershell
cd "C:\Users\Alex\Documents\New project\apps\admin"
npm install
npm run dev
```

Then open:

- `http://localhost:3000`

This app is intended to replace the old static placeholder and later move to a real API-backed mode once the VPS backend is live.
