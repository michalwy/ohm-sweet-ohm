# Supplier integrations

## DigiKey

- The repository keeps a supplier-response shape note at `docs/integrations-digikey-search-sample.json`.
- For source category mapping, prefer the explicit tree path from `Products[].Category.Name` and the
  nested `Products[].Category.ChildCategories[]` (deepest branch), instead of flat or fuzzy category
  keys.

## TME

- Response notes and examples: `docs/integrations-tme.md` and `docs/integrations-tme-*-sample.json`.
- In `/products/search`, product rows are under `data.products.elements[]`, while
  `data.parameters.elements[]` are result-level facets — not reliable as per-product attributes for
  broad queries.
- For per-product attributes, use `GET /products/parameters` with the selected symbol.
- For full source category paths, derive from cached `GET /products/categories/list` data (`id` +
  `parent_id`) rather than relying on the immediate `product.category.name` alone.

## The API and MCP (#285)

- The add-part dialog's server actions (`supplierActions.ts`, `matching.ts`) and the API/MCP
  (`supplierApi.ts`) both go through `supplierLookup.ts`, and every request to a supplier is built by
  `digikey.ts` / `tme.ts`. **Keep it that way**: the owner approved API-triggered supplier requests
  only with exactly the payloads the UI sends (#285). The API asks for at most the dialog's page
  size (10). `tests/integration/api-supplier-lookup.test.ts` records the outgoing requests and
  compares them with the dialog's path; changing what is sent stays a guardrail.
- Credentials are never in an operation's input or output.
- Accepted matches are recorded by `create_part`'s `supplierMatching`; its category and attribute ids
  are checked to be the workspace's own before `learnSupplierMatching` stores them.
- The search and attribute tools carry the MCP `openWorldHint` (`openWorld: true` in `tools.ts`).
