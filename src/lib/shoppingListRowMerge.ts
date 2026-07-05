export type ShoppingListRow = {
  partId: string;
  quantity: string;
};

/**
 * Sums quantities by partId and drops non-positive/blank rows. Needed before calling
 * addMultipleShoppingListItemsForWorkspace, which only merges against parts already on the
 * list at call time — not against duplicate partIds within its own `items` argument.
 */
export function mergeShoppingListRows(rows: ShoppingListRow[]): ShoppingListRow[] {
  const totals = new Map<string, number>();
  const order: string[] = [];

  for (const row of rows) {
    const qty = parseFloat(row.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!totals.has(row.partId)) order.push(row.partId);
    totals.set(row.partId, (totals.get(row.partId) ?? 0) + qty);
  }

  return order.map((partId) => ({ partId, quantity: String(totals.get(partId)) }));
}
