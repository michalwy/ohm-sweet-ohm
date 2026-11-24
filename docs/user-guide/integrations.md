---
title: Integrations
---

## Configure Supplier Integrations

In **Settings > Integrations**, you can configure workspace-level supplier settings.

Current providers:

- DigiKey (client ID + client secret)
- TME (API token + application secret)

You can also choose which provider is active for the workspace.

Assistants and scripts can search the active provider too, through the
[API and MCP server](api-and-mcp.md#what-is-available): they use the workspace's credentials and
send the supplier exactly what the add-part dialog sends, but can never read or change the
credentials. A search needs the **parts:write** permission, as adding a part does.
