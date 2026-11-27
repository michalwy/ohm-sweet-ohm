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
and if your roles change, your tokens follow on their next use.

A few things in the app are for a workspace's **administrators** only: its ordering, inventory and supplier
settings, loading the starter dictionaries, and archiving or restoring it. A token reaches them only
when it has the `workspace:write` permission ("Update workspace settings") **and** you are an
administrator of the workspace it acts on. A token with `workspace:write` can also create a new
workspace (you become its owner), and archive or restore any workspace you administer, not only its
own — archiving its own workspace ends the token. Resetting a workspace to demo data and deleting a
workspace stay in the app. A token stays bound to its own workspace: to work in a workspace you
created or restored, create a token for it.

A token stops working when you revoke it, when it expires, when its workspace is archived, or when
you leave its workspace. The **Status** column shows which of these applies; **Last used** shows
when the token was last accepted (updated at most once a minute).

### Using a token

Send the token in every request's `Authorization` header as `Bearer <token>`; the API and the MCP
server accept nothing else — being signed in to OSO in your browser does not open them.

- **REST API** — `<your OSO address>/api/v1`. `GET /api/v1/me` tells you who the token acts as, in
  which workspace and with which permissions. The full description of the API, in OpenAPI 3.1, is
  at `/api/v1/openapi.json` (no token needed to read it).
- **MCP** — `<your OSO address>/api/mcp`, over Streamable HTTP: add it to an MCP client such as
  Claude Code or Claude Desktop as a remote server, with the token as its bearer header. The
  `whoami` tool tells the agent who it acts as.

[API and MCP](api-and-mcp.md) explains how to call the API, how to connect Claude Code, Claude
Desktop or claude.ai, and what each one offers today.

### Revoking a token

Select **Revoke** on the token's row and confirm. Anything using the token stops working at once;
this cannot be undone.

## Connected Apps

**Settings → Connected apps** lists the apps you connected to OSO by signing in and approving them —
for example OSO added as a **custom connector in claude.ai** ([API and MCP](api-and-mcp.md#claudeai-custom-connector)).
It shows, for each app, the workspace it acts in, its access (read-only or read-write), when you
connected it and when it was last used. The page lists all your apps, from every workspace.

A connected app works like an API token you never have to copy: it acts as **you**, in the one
workspace you chose when you approved it, never with more than your roles there allow, and only
through the MCP server (`/api/mcp`) — not the REST API. Its access lasts until you disconnect it;
the app renews it by itself.

Select **Disconnect** on its row and confirm to take its access away at once: its next call is
refused, and to use it again you connect it again. Approving the same app again (for example to
pick another workspace) replaces the earlier approval.
