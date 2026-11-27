---
title: Instance administration
---

# Instance administration

The **instance administration** panel lets the person who runs an OSO instance see who uses it and
how much, clean up accounts, open or close registration, and read the feedback people send — without touching the database. It is
for the whole instance, not for one workspace.

## Who is the administrator

The **first account created on the instance** is its administrator. Only the administrator sees the
**Instance administration** button on the Workspaces screen (`/admin`); anyone else who opens the
address gets *page not found*, and the panel's actions and the admin MCP tools refuse them.

## Accounts

The panel lists every account, oldest first: its email and name, when it was created, how many
workspaces it belongs to, how many of them it owns (holds the *owner* role in), and the storage it
uses. Open an account to see each of its workspaces with the account's roles there, the number of
members, and whether the account **solely owns** it — owns it and no other member does.

## Deleting an account or its data

On an account's page there are two actions. Both take effect **at once and cannot be undone**; each
asks you to type the account's email to confirm.

- **Delete data** deletes every workspace the account solely owns, with everything in it. The
  account itself stays, and so do workspaces it co-owns with someone else.
- **Delete user** deletes the account: its sessions, API tokens, connected apps and memberships, and
  every workspace it was the only member of. Tick **Also delete every workspace this user solely
  owns** to delete those as well; otherwise they stay for their other members. Stock movements,
  orders, shopping lists and builds the account recorded in shared workspaces stay, without their
  author.

You cannot delete your own account or an administrator's here.

## Storage

OSO keeps everything in its PostgreSQL database; there are no uploaded files. The panel shows:

- **Database size** — the whole database on disk;
- each **workspace** — the size of its rows. Indexes and database overhead are not attributed, so
  the workspace figures add up to less than the database size;
- each **account** — the sum of the workspaces it belongs to, so a shared workspace counts for each
  of its members.

## Registration

The **Registration** card shows whether new accounts can register now, and whether that is the
configuration default (`OSO_AUTH_ALLOW_SIGN_UP`, see the [Deployment guide](deployment.md)) or a
setting made in this panel. **Open registration** / **Close registration** changes it at once, and
it stays that way — whatever the configuration says — until you change it again. An instance with no
accounts always lets the first account be created.

## Feedback

Reports people send with **Send feedback** (see [Sending feedback](feedback.md)) are listed under
**Feedback** in the panel — the card shows how many are **new**. The list shows each report's time,
kind (problem, idea, question), status, message, reporter (or *Anonymous*) and the GitHub issue it
became; filter it by **New** or **Triaged**. Open a report to read the whole message and the
diagnostic context sent with it, and in **Triage** set its status and the **GitHub issue URL**
(`https://github.com/<owner>/<repo>/issues/<n>`; leave it empty to clear it).

Deleting the reporter's account or the workspace keeps the report, without the link to them.

## From Claude (MCP)

The same operations are MCP tools, offered only when the token's or connected app's user is the
administrator: `admin_list_users`, `admin_get_user`, `admin_delete_user` (`deleteData` to delete the
solely owned workspaces too), `admin_delete_user_data`, `admin_get_storage_usage`,
`admin_get_registration`, `admin_set_registration_open`, and for feedback `admin_list_feedback`
(`status` to show only new or triaged reports), `admin_get_feedback` and `admin_update_feedback`
(status and issue URL). The tools that change something need a
**read-write** token or connection; a read-only one can only look. There are no REST endpoints for
them. See [API and MCP](api-and-mcp.md).
