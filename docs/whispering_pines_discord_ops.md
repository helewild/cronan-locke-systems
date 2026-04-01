# Whispering Pines Discord Ops

This document tracks the Discord structure, operational bot flows, and the remaining manual actions that cannot be completed purely from the bot side.

## Current Bot Capabilities

- Create categories, text channels, and voice channels
- Open private tickets:
  - `!ticket open support`
  - `!ticket open report`
  - `!ticket open appeal`
- Close ticket/application channels:
  - `!ticket close`
- Open private applications:
  - `!apply citizen`
  - `!apply business-owner`
  - `!apply lspd`
  - `!apply bcso`
  - `!apply ems`
  - `!apply doj`
  - `!apply media`
- Staff actions:
  - `!verify @user`
  - `!unverify @user`
  - `!approve`
  - `!approve @user role`
  - `!deny <reason>`
  - `!addrole @user role`
  - `!removerole @user role`

## Current Server Layout

### Roles

- Founder
- Admin
- Senior Staff
- Moderator
- Developer
- Verified
- Citizen
- Business Owner
- LSPD
- BCSO
- SAFR / EMS
- DOJ
- Media
- Unverified

### Categories

- START HERE
- WHISPERING PINES
- COMMUNITY
- ECONOMY & BUSINESS
- LAW ENFORCEMENT
- EMS & FIRE
- DOJ & GOVERNMENT
- MEDIA
- SUPPORT
- STAFF
- VOICE
- TICKETS
- APPLICATION REVIEW

## Content Already Posted

- Welcome message
- Rules and guidelines
- Server lore
- Verification and role-request process
- Support-desk structure
- RP starter guide
- City hall intro
- Marketplace intro
- Bank intro
- Looking-for-RP intro
- General chat intro

## Logging

The bot now writes staff-facing operational logs into `#bot-logs`, including:

- ticket openings
- application openings
- role approvals
- denials
- verification actions
- role additions/removals
- transcript snapshots on channel closure

## Remaining Manual Actions

These still need to be done outside the current bot runtime:

1. Rotate the bot token in the Discord Developer Portal.
2. Replace the token in `sandbox/discord-bot/.env`.
3. Move the bot role higher in Discord's role hierarchy so it can fully clean legacy roles and manage all allowed roles beneath staff.
4. If you want automatic `Unverified` assignment on member join, enable the Server Members Intent in the Discord Developer Portal and then add/join-enable that logic in the bot.
5. If you want slash commands instead of message commands, register application commands for the current guild and optionally migrate member-facing flows to slash-first UX.

## Recommended Next Enhancements

- Convert member-facing flows to slash commands
- Add verification buttons or dropdowns
- Add application status tags such as pending, approved, denied
- Add richer transcript exports to files
- Add whitelist/business registry persistence if the RP sim grows
