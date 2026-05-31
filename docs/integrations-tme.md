# TME Integration Notes

This document describes how OSO currently integrates with the TME API for parts import suggestions and supplier matching.

## Endpoint Summary

- Token: `POST /auth/token`
- Search suggestions: `GET /products/search`
- Product-specific attributes: `GET /products/parameters`
- Category metadata: `GET /products/categories/list` and `GET /products/categories/tree`

Base URL: `https://api.tme.eu`

## Authentication

TME auth uses OAuth2 client credentials with HTTP Basic Auth:

- Basic username: TME API token
- Basic password: TME application secret
- Body: `grant_type=client_credentials`

The app stores these workspace credentials in `WorkspaceTmeIntegration`.

## Search Behavior

`/products/search` is used for live supplier suggestions in the Add part dialog.

Request shape currently used by the app:

- `country=PL`
- `phrase=<query>`
- `limit=<page size>`
- `page=<1-based page>`
- `scope[]=products`
- `scope[]=parameters`
- `scope[]=counters`

Pagination mapping:

- Incoming UI offset is converted to TME page using `page = floor(offset / limit) + 1`.
- Next-page cursor/offset uses `data.counters.total` (with fallbacks to `data.total`, `total`, `data.count`, `count`).

## Important Payload Shapes

Observed shapes from live API calls:

- Product rows come from `data.products.elements[]`.
- Search-level parameter facets come from `data.parameters.elements[]`.
- Broad phrases (for example `NE`) return mixed products and mixed parameter facets.

Because search-level `parameters` are faceted for the whole result set, they are not reliable for per-product matching when the query is broad.

## Per-Product Attribute Extraction

When the user chooses a specific TME suggestion, OSO performs an additional call:

- `GET /products/parameters?country=PL&symbols[]=<selected symbol>`

The response contains per-symbol parameters under:

- `data.elements[].parameters.elements[]`

This is the preferred source for supplier-to-attribute matching in the dialog.

Fallback strategy:

- If the per-product call returns no usable data or fails, the UI falls back to attributes already present in the selected search suggestion.

## Category Path Enrichment and Cache

`/products/search` includes only immediate category info per product (`category.id`, `category.name`).

To derive full source category paths, the app caches `GET /products/categories/list` by workspace and country and reconstructs paths using `parent_id` relationships.

Cache table:

- `WorkspaceTmeCategoryCache`

Cache key and freshness:

- Key: `(workspaceId, country)`
- TTL: 10 days
- If stale, refresh from TME; if refresh fails, continue using existing cache when available.

## Sample Payload Files

The repository includes trimmed, real-world examples captured from live calls:

- `docs/integrations-tme-search-ne555p-sample.json`
- `docs/integrations-tme-search-ne-sample.json`
- `docs/integrations-tme-parameters-ne555p-sample.json`
- `docs/integrations-tme-categories-list-sample.json`
- `docs/integrations-tme-categories-tree-sample.json`

The existing DigiKey reference remains in:

- `docs/integrations-digikey-search-sample.json`
