---
title: Settings & Permissions
---

## Permissions And Read-Only Behavior

What you can edit depends on your workspace permissions.

In some cases, a feature remains visible but actions are disabled.  
This is expected behavior when your role has read-only access for that area.

## API Tokens

**Settings → API tokens** is where you create personal tokens for scripts, the REST API and MCP
clients such as Claude. A token is yours: it acts as you, so everything it does is done in your
name. The page lists all your tokens, from every workspace.

### Creating a token

Select **Create token** and fill in:

- **Name** — what the token is for, for example "Claude on my laptop".
- **Workspace** — the one workspace the token works in. It defaults to the workspace you are in; you
  can pick any active workspace you are a member of. A token never reaches another workspace.
- **Permissions**:
  - **Read-only** — read everything you can read in the workspace;
  - **Read-write** — read and change everything you can in the workspace;
  - **Custom** — only the permissions you tick.
- **Expires** — never, or in 7, 30, 90 or 365 days (90 by default).

The token's value is shown **once**, right after you create it. Copy it then and store it somewhere
safe: OSO keeps only a fingerprint of it and cannot show it again. If you lose it, revoke the token
and create a new one.

### What a token can do

A token can never do more than you can. What it may do is the permissions you gave it **and** what
your roles in its workspace allow, both at once — so a read-write token of a reader can only read,
and if your roles change, your tokens follow on their next use. No token holds the workspace's
administrative access: archiving, restoring, resetting or deleting a workspace stays in the app.

A token stops working when you revoke it, when it expires, when its workspace is archived, or when
you leave its workspace. The **Status** column shows which of these applies; **Last used** shows
when the token was last accepted (updated at most once a minute).

### Revoking a token

Select **Revoke** on the token's row and confirm. Anything using the token stops working at once;
this cannot be undone.
