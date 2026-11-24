// Column alignment shared by every list built on `ListTable` (#245). Pure, so it is unit-tested.
import type { ListColumnDefinition } from "@/app/list-table-config";

export type ListColumnAlign = NonNullable<ListColumnDefinition["align"]>;

/** Text alignment for a column's header and cells; a measured-quantity column is always centered. */
export function resolveListColumnAlign(
  columnDef: ListColumnDefinition | undefined
): ListColumnAlign {
  if (columnDef?.measuredQuantity) return "center";
  return columnDef?.align ?? "left";
}

/**
 * Tailwind class that centers a measured-quantity cell, for tables not built on `ListTable`
 * (e.g. the attribute table on part detail). `ListTable` applies it on its own.
 */
export const MEASURED_QUANTITY_CELL_CLASS = "text-center";

/** Column-definition fields for the part Value column. */
export function partValueColumnFlags(): Pick<ListColumnDefinition, "align" | "measuredQuantity"> {
  return { align: "center", measuredQuantity: true };
}

/**
 * Column-definition fields for a workspace attribute column. Quantity attributes are measured
 * quantities (centered header and cells); other types keep their centered header only.
 */
export function attributeColumnFlags(attribute: {
  type: string;
}): Pick<ListColumnDefinition, "align" | "measuredQuantity"> {
  return attribute.type === "QUANTITY"
    ? { align: "center", measuredQuantity: true }
    : { align: "center" };
}
