---
title: API and MCP
---

OSO can be used from outside the browser in two ways:

- the **REST API** under `/api/v1`, for scripts and other programs;
- the **MCP server** at `/api/mcp`, for AI assistants such as Claude, which can then look things up
  and make changes in your workshop on your behalf.

Both work in the same way: they act as **you**, in **one workspace**, with a **personal API token**
you create in OSO. They offer the same things — every MCP tool has a matching REST endpoint — and
they grow area by area (see [What is available](#what-is-available)).

In the examples below, `https://oso.example.com` stands for your OSO address — the public HTTPS
address of your instance (see [Deployment](deployment.md#https-with-a-reverse-proxy)), or
`http://localhost:3000` when you run OSO on your own computer.

## 1. Create a token

Open **Settings → API tokens** and select **Create token**. Give it a name that says where it will
be used (for example "Claude Code on my laptop"), pick the **workspace** it should work in, its
**permissions** and when it **expires**. Copy the token's value when it is shown — it starts with
`oso_` and is shown only once.

Some advice:

- **One token per program or computer.** If one leaks, you revoke only that one.
- **Read-only first.** Give an assistant a read-only token until you want it to make changes.
- A token never does more than you can do yourself, and never reaches another workspace. If you
  work in several workspaces, create a token for each.
- Treat the token like a password: anyone who has it can act as you in that workspace.

[Settings & Permissions](settings.md#api-tokens) explains the token's options, what it can do, and
how to revoke it.

## 2. Use the REST API

Send the token in the `Authorization` header of every request, as `Bearer <token>`. Being signed in
to OSO in your browser does not open the API; only the token does.

Check that it works with `GET /api/v1/me`, which tells you who the token acts as, in which workspace
and with which permissions:

```bash
curl -H "Authorization: Bearer oso_…" https://oso.example.com/api/v1/me
```

```json
{
  "user": { "id": "…", "name": "Ada", "email": "ada@example.com" },
  "workspace": { "id": "…", "name": "Home lab", "slug": "home-lab" },
  "permissions": ["inventory:read", "parts:read", "…"]
}
```

### The API description

The full description of the API — every endpoint, its input and its answer — is an
**OpenAPI 3.1** document at:

```text
https://oso.example.com/api/v1/openapi.json
```

Reading it needs no token. Open it in any OpenAPI viewer, or give it to a code generator to get a
client for your language. It always describes the version of OSO you are running.

### How the API behaves

- **JSON in, JSON out.** `GET` requests take their input from the query string; `POST`, `PUT`,
  `PATCH` and `DELETE` take a JSON body. A single record is addressed by its id in the path, as in
  `GET /api/v1/parts/{id}`.
- **`PATCH` changes only what you send.** Fields you leave out keep their values.
- **Lists come in pages.** A list answers with up to `pageSize` items and a `nextCursor`; pass it
  back as `?cursor=<nextCursor>` to get the next page. There are no more pages when it is `null`.
- **Errors** have one shape, `{ "error": { "code": …, "message": …, "issues": … } }`, with the HTTP
  status telling what kind of problem it is:

  | Status | Meaning |
  | --- | --- |
  | 400 | The input is not valid (`invalid-input`, with `issues` naming each field) or not acceptable. |
  | 401 | No valid token: it is missing, mistyped, revoked or expired, or its workspace is archived. |
  | 403 | The token, or your role, lacks the permission this needs (`permission-denied`). |
  | 404 | No such record **in the token's workspace**. |
  | 409 | The request is valid, but the record's current state does not allow it. |

- **Stable version.** Everything stays under `/api/v1`: new endpoints and new fields are added
  without notice, so a client should ignore fields it does not know. A change that would break
  existing clients would come as `/api/v2`.

## 3. Connect Claude (MCP)

The MCP server is at `https://oso.example.com/api/mcp`. It is a **remote** MCP server using
**Streamable HTTP**, authenticated by the same `Authorization: Bearer <token>` header. Once
connected, ask the assistant something like *"Who am I in OSO?"* — its `whoami` tool tells it the
user, the workspace and the permissions it has.

The assistant acts in the token's workspace only, with the token's permissions. Tools that only
read are marked as such; tools that change or delete data are marked too, so your MCP client can
ask you before it runs them.

### Claude Code

Add the server from a terminal:

```bash
claude mcp add --transport http oso https://oso.example.com/api/mcp \
  --header "Authorization: Bearer oso_…"
```

Add `--scope user` to make it available in every project on this computer, not only the current
one. Run `/mcp` inside Claude Code to check that **oso** is connected.

### Claude Desktop

Claude Desktop starts its local MCP servers from a configuration file. Use the small
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge, which needs
[Node.js](https://nodejs.org/) installed, to connect it to OSO:

1. In Claude Desktop open **Settings → Developer → Edit Config**. This opens
   `claude_desktop_config.json`.
2. Add OSO under `mcpServers`:

   ```json
   {
     "mcpServers": {
       "oso": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "https://oso.example.com/api/mcp",
           "--header",
           "Authorization:${OSO_AUTH}"
         ],
         "env": {
           "OSO_AUTH": "Bearer oso_…"
         }
       }
     }
   }
   ```

   The header is passed through `env` because some systems split arguments at spaces.
3. Save the file and restart Claude Desktop. OSO's tools appear in the tools menu of a new chat.

Claude Desktop's own **Settings → Connectors** adds the same kind of custom connector as claude.ai,
with the same limits — see the next section.

### claude.ai (custom connector)

A custom connector is called by Claude's servers, not by your computer, so it works only when your
OSO address is **reachable from the internet** over HTTPS. An instance that is reachable only from
your home network cannot be connected this way; use Claude Code or Claude Desktop instead.

OSO does not offer OAuth sign-in, so the connector must send the token as a request header. On
claude.ai this option (**request headers**) is in beta and not yet available to every account; if
you do not see it when you add a custom connector, your account cannot connect to OSO this way yet.
Where it is available:

1. In claude.ai open **Settings → Connectors** and add a **custom connector**.
2. As its URL, enter `https://oso.example.com/api/mcp`.
3. Add a request header named `Authorization` whose value is `Bearer oso_…` — the word `Bearer`, a
   space, then the token; Claude sends the value exactly as entered.

Keep in mind that the token then lives with that claude.ai account, and in an organization the
connector may be shared with its members: everyone who uses it acts as **you**. Give such a token
the least permissions that do the job.

## What is available

The API and MCP server grow area by area. Each row below lists what is available today, with REST
paths relative to `/api/v1`; the OpenAPI document and the MCP server's tool list are always the
complete, exact reference for the version you run.

| Area | REST endpoints | MCP tools |
| --- | --- | --- |
| Workspace | `GET /me`, `GET /workspace`, `PATCH /workspace` (ordering defaults and the supplier catalogue; only the fields you send change), `POST /workspace/starter-dictionaries`, `GET` / `PATCH /me/display-preferences` (yours, in every workspace); your workspaces: `GET /workspaces` (`includeArchived`), `POST /workspaces`, `POST /workspaces/{id}/archive`, `POST /workspaces/{id}/restore` — changing settings, loading the starter dictionaries, archiving and restoring need you to be an administrator of the workspace, and a token stays bound to its own workspace (create a token for a new or restored one) | `whoami`, `get_workspace`, `update_workspace_settings`, `load_starter_dictionaries`, `get_display_preferences`, `update_display_preferences`, `list_workspaces`, `create_workspace`, `archive_workspace`, `restore_workspace` |
| Organizations (manufacturers and suppliers) | `GET /organizations` (`searchQuery`, `roleFilter`), `POST /organizations`, `GET /organizations/{id}`, `PATCH /organizations/{id}` (only the fields you send change), `DELETE /organizations/{id}` | `list_organizations`, `get_organization`, `create_organization`, `update_organization`, `delete_organization` |
| Part categories | `GET /part-categories` (the whole tree), `POST /part-categories`, `POST /part-categories/paths` (a path such as `Passives/Resistors/SMD` at once), `PATCH /part-categories/{categoryId}`, `POST /part-categories/{categoryId}/move`, `DELETE /part-categories/{categoryId}` | `get_part_category_tree`, `create_part_category`, `create_part_category_path`, `update_part_category`, `move_part_category`, `delete_part_category` |
| Attributes | `GET /attributes`, `POST /attributes`, `PATCH /attributes/{attributeId}`, `DELETE /attributes/{attributeId}`, `POST /attributes/{attributeId}/choice-options`, `PATCH /attribute-choice-options/{optionId}`, `DELETE /attribute-choice-options/{optionId}`; on a category: `GET /part-categories/{categoryId}/attributes` (its effective attributes), `PUT /part-categories/{categoryId}/attributes` (save its whole configuration), `PUT` / `DELETE /part-categories/{categoryId}/attributes/{attributeId}` (attach or override / detach), `PUT /part-categories/{categoryId}/value-attribute`; on the workspace: `GET` / `PUT /workspace/attributes` | `list_attributes`, `create_attribute`, `update_attribute`, `delete_attribute`, `create_attribute_choice_option`, `update_attribute_choice_option`, `delete_attribute_choice_option`, `get_category_attributes`, `save_category_attribute_configuration`, `attach_category_attribute`, `detach_category_attribute`, `set_category_value_attribute`, `get_workspace_attributes`, `save_workspace_attribute_configuration` |
| Units | `GET /units`, `POST /units`, `PATCH /units/{unitId}`, `DELETE /units/{unitId}` | `list_units`, `create_unit`, `update_unit`, `delete_unit` |
| Parts | `GET /parts`, `POST /parts`, `GET /parts/{id}`, `PATCH /parts/{id}`, `DELETE /parts/{id}` | `list_parts`, `get_part`, `create_part`, `update_part`, `delete_part` |
| Shopping lists | `GET /shopping-lists` (`searchQuery`, `sortBy`), `POST /shopping-lists`, `GET /shopping-lists/{listId}` (with its items), `PATCH /shopping-lists/{listId}`, `DELETE /shopping-lists/{listId}`, `POST /shopping-lists/{listId}/items` (one part, as a new item), `POST /shopping-lists/{listId}/items/batch` (several parts; a part already on the list is added to its item), `PATCH` / `DELETE /shopping-lists/{listId}/items/{itemId}`, `POST /shopping-lists/{listId}/convert-to-purchase-order` (to a new draft order for a supplier, or to an existing draft order), `GET /parts/{id}/shopping-lists` (the lists a part is on) | `list_shopping_lists`, `get_shopping_list`, `create_shopping_list`, `update_shopping_list`, `delete_shopping_list`, `add_shopping_list_item`, `add_shopping_list_items`, `update_shopping_list_item`, `remove_shopping_list_item`, `convert_shopping_list_to_purchase_order`, `get_part_shopping_lists` |
| Locations | `GET /locations` (the whole tree, with each location's path), `POST /locations`, `POST /locations/generate` (the location generator), `GET /locations/{id}`, `PATCH /locations/{id}` (only the fields you send change; `isArchived` archives), `DELETE /locations/{id}` | `list_locations`, `create_location`, `generate_locations`, `get_location`, `update_location`, `delete_location` |
| Inventory (stock) | `POST /inventory/entries` (record a receipt, issue, transfer or adjustment), `GET /inventory/entries?partId=…` (a part's movement history, newest first), `GET /inventory/balances?partId=…` (a part's stock per location), `GET /locations/{id}/stock` (`includeSublocations`) | `create_inventory_entry`, `list_inventory_entries`, `get_part_stock_balances`, `get_location_stock` |
| Builds | `GET /builds` (`searchQuery`, `stateFilter`, `createdAtFilter`, `designIdFilter`, `sortBy`), `POST /builds` (pre-fills each line with a suggested allocation, as the UI does), `GET /builds/create-options` (designs with their revisions, and locations), `GET /builds/{buildId}` (lines, allocations, candidate parts, units), `DELETE /builds/{buildId}`, `PUT /builds/{buildId}/allocations` (the whole build's allocation), `PUT /builds/{buildId}/lines/{lineId}/allocations` (one line's), `POST /builds/{buildId}/start`, `POST /builds/{buildId}/assignments/{assignmentId}/assemble` (one designator of one unit), `POST /builds/{buildId}/assemble-unit` (`unitIndex`, from 1), `POST /builds/{buildId}/assignments/{assignmentId}/reassign` (another part or location for a designator), `POST /builds/{buildId}/cancel`, `GET /builds/{buildId}/pick-list`, `GET /builds/{buildId}/assembly-list`, `GET /parts/{id}/build-allocations`, `GET /parts/{id}/production-builds` | `list_builds`, `get_build`, `get_build_create_options`, `create_build`, `delete_build`, `set_build_allocations`, `set_build_line_allocations`, `start_build`, `assemble_build_designator`, `assemble_build_unit`, `reassign_build_designator`, `cancel_build`, `get_build_pick_list`, `get_build_assembly_list`, `get_part_build_allocations`, `get_part_production_builds` |

## What is not exposed

Everything you can do in the app is meant to be reachable through the API and MCP — reading and
changing, deleting included — **except**:

- **resetting a workspace to a demo preset**, and **scheduling a workspace for deletion**;
- **signing up, signing in and signing out**;
- **DigiKey and TME credentials**: they can never be read or changed through the API or MCP.
  Searching the suppliers' catalogs is allowed, and sends them what the app itself sends;
- **members and roles**, which are not part of the API yet.

Webhooks are not offered either.

Parts of the app that exist only to help a screen — the data behind a dialog, the options of a
filter, a preview of the next document number — are not offered as tools unless an assistant needs
them to finish a task.

There is no rate limiting and no audit log of what a token did; the token list shows only when each
token was **last used**.

## Troubleshooting

- **401 `unauthorized`** — check that the header reads exactly `Authorization: Bearer oso_…`, and in
  **Settings → API tokens** that the token's status is *Active*.
- **403 `permission-denied`** — the token or your role lacks a permission. `GET /api/v1/me` (or the
  `whoami` tool) lists the permissions the token really has.
- **404 on a record you can see in the app** — the record is in another workspace than the token's.
- **The MCP client cannot connect** — open `https://oso.example.com/api/v1/openapi.json` from the
  same computer. If that fails, the problem is the address or the network, not the token. The MCP
  server answers only `POST` requests; opening `/api/mcp` in a browser shows a *Method not allowed*
  error, which is normal.
