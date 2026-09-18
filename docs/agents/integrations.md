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
