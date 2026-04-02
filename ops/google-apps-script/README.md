# Google Apps Script Bridge

This folder contains the temporary live bridge for Cronan & Locke Systems while the VPS is not available.

## Purpose

The bridge supports:

- setup-box tenant registration
- first-owner activation
- website login
- session validation
- dashboard payload delivery

## Deployment

1. Create a new Google Apps Script project.
2. Copy in:
   - `Code.gs`
   - `appsscript.json`
3. Connect it to the Google Sheet workbook that matches [google_sheets_schema.md](/C:/Users/Alex/Documents/New%20project/docs/google_sheets_schema.md).
4. Deploy as a Web App.
5. Paste the deployed web app URL into `CONFIG.apiUrl` in [site.js](/C:/Users/Alex/Documents/New%20project/site.js).

## Temporary Notes

- This is a bridge, not the final backend.
- It should be treated as a practical stopgap until the VPS API is ready.
- Passwords should be hashed before storage.
