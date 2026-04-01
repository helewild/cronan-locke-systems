# Discord Channel Bot

A small Discord bot that can create categories, text channels, voice channels, tickets, applications, and staff role actions.

## Setup

1. Copy `.env.example` to `.env`.
2. Put in your bot token.
3. Optionally set `GUILD_ID` to the server the local dashboard should target by default.
4. Install dependencies:

```powershell
npm install
```

4. Start the bot:

```powershell
npm start
```

Start the web dashboard:

```powershell
npm run dashboard
```

Backup/export:

```powershell
npm run backup
```

Pin onboarding posts:

```powershell
npm run pin:onboarding
```

## Required Bot Permissions

- View Channels
- Send Messages
- Manage Channels
- Read Message History

## Recommended Privileged Gateway Intents

- Message Content Intent: on
- Server Members Intent: recommended if you want automatic `Unverified` assignment and join logging

## Commands

```text
!help
!creator
!category "Staff"
!text "rules"
!text "announcements" "Staff"
!voice "Meeting Room" "Staff"
!template basic
!template gaming
!ticket open support
!ticket open report
!ticket open appeal
!ticket close
!apply citizen
!apply business-owner
!apply sheriffs-office
!apply bcso
!apply medical
!apply fire-department
!apply doj
!apply media
!apply events-team
!apply real-estate
!apply management
!verify @user
!unverify @user
!approve
!approve @user business-owner
!deny Not enough application detail yet.
!warn @user Repeated scene disruption.
!note @user Good follow-up after staff conversation.
!history @user
!profile @user
!roster sheriffs-office
!discipline @user timeout 60 Scene violation
!case WP-0001
!business list
!business add "Pines Auto" @user licensed
!business close "Pines Auto" License revoked
!announce #announcements update "Title" "Body"
!health
!dashboard
!appstatus waiting Waiting on updated background details.
!addrole @user media
!removerole @user media
```

## Notes

- Text channel names are normalized to Discord-friendly lowercase slugs.
- The bot can now respond in every server it is invited to.
- `GUILD_ID` is now optional for the bot runtime and is mainly used by the local dashboard and any single-server utilities.
- Re-run `node src/register_slash_commands.js` after inviting the bot to a new server so slash commands get registered there too.
- Shared server defaults now live in `config/server_settings.json`.
- You can add a guild-specific override under `guilds.<server_id>` in `config/server_settings.json` to customize role names, application buttons, roster groups, required channels, and onboarding text for a second server without changing the code.
- Members can open tickets and applications without special permissions.
- If Server Members Intent is enabled, new joins can automatically receive `Unverified`.
- Anyone can use `!creator` or `/creator` to see who built the bot.
- Staff can approve, deny, verify, and manage roles through commands.
- Diagnostics-enabled staff can use `!health`, `!dashboard`, `/health`, and `/dashboard`.
- Senior review staff can mark an application as waiting with `!appstatus` or `/appstatus`.
- Staff can pull a full member profile with `!profile` or `/profile`.
- Staff can view faction or staff rosters with `!roster` or `/roster`.
- Staff can record escalation actions with `!discipline` or `/discipline`.
- Staff can look up any stored case ID with `!case` or `/case`.
- Review staff can maintain a business registry with `!business` or `/business`.
- Diagnostics-enabled staff can post formatted announcements with `!announce` or `/announce`.
- Application buttons now open a modal form before creating the private review channel.
- New staff records now receive automatic case IDs like `WP-0001`.
- Warnings, staff notes, role actions, tickets, applications, discipline, businesses, and announcements are persisted in `data/store.json`.
- Closed ticket/application transcripts are exported into `data/transcripts`.
- Ticket and application actions are logged into a private `#bot-logs` channel.
- You can export a local JSON snapshot of the server layout and recent messages with `npm run backup`.
- You can auto-pin the main onboarding/reference posts with `npm run pin:onboarding`.
- The local dashboard runs on `http://localhost:3210` by default and uses the bot token in `.env`.
- The dashboard can now post announcements to Discord and add or close business registry entries directly from the browser.
- The dashboard can now list open support tickets, load ticket messages, send staff replies, and close tickets.
- You can edit application modal titles and field labels in `config/application_forms.json` without changing bot logic.
- Users need `Manage Channels` permission only for manual channel-creation commands.
