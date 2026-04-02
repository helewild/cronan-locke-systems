# Temporary Live Stack

Cronan & Locke Systems can run in a temporary live mode before the VPS is ready by using:

- GitHub Pages for the public website
- Google Apps Script as the temporary API/auth bridge
- Google Sheets as the temporary data store

## Intended Owner Flow

1. A buyer purchases the product from Marketplace.
2. They rez the setup box in-world.
3. The setup box registers the buyer avatar against the bridge.
4. The bridge creates or reserves the tenant record.
5. The bridge issues a one-time activation code or temporary credential.
6. The buyer opens the website and lands on the login screen, not the admin panel.
7. They complete first-time setup and become the tenant owner.
8. After that, normal username/password login grants access to the admin terminal.

## Current Website Behavior

The root GitHub Pages site now supports:

- login-first landing page
- first-time owner setup screen
- demo-mode activation and login fallback
- authenticated admin terminal view after login
- future Apps Script endpoint hook via `CONFIG.apiUrl` in [index.html](/C:/Users/Alex/Documents/New%20project/index.html) and [site.js](/C:/Users/Alex/Documents/New%20project/site.js)

## Temporary Security Model

- The admin terminal should never render by default for anonymous visitors.
- Public visitors should only see login/setup.
- Owner activation should be one-time.
- Production passwords should never be hardcoded in the setup box.
- A one-time activation token is preferred over a reusable temporary password.

## Bridge Responsibilities

The Apps Script layer should be responsible for:

- tenant bootstrap after setup box registration
- owner activation validation
- username/password login
- session token issuance
- admin dashboard payloads
- light admin actions during the temporary phase

## Migration Later

When the VPS is ready:

- keep the website flow
- replace Apps Script with the real API
- replace Sheets with the real database
- keep the owner activation and login model intact
