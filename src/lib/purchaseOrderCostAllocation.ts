export type AdditionalCostAllocationItem = {
  itemId: string;
  lineNetValue: number;
  quantity: number;
  eligible: boolean;
};

/**
 * Spreads an order's additional costs (shipping, customs, etc.) across its line items,
 * proportional to each eligible line's net value over the full ordered quantity. Depends
 * only on static per-line/order values, so the result is stable across partial receives.
 */
export function computeAllocatedUnitCosts(
  items: AdditionalCostAllocationItem[],
  totalAdditionalCosts: number
): Map<string, number> {
  const result = new Map<string, number>();

  const eligibleLineNetSum = items
    .filter((item) => item.eligible)
    .reduce((sum, item) => sum + item.lineNetValue, 0);

  for (const item of items) {
    if (!item.eligible || totalAdditionalCosts === 0 || eligibleLineNetSum === 0 || item.quantity === 0) {
      result.set(item.itemId, 0);
      continue;
    }
    const allocatedShare = totalAdditionalCosts * (item.lineNetValue / eligibleLineNetSum);
    result.set(item.itemId, allocatedShare / item.quantity);
  }

  return result;
}
