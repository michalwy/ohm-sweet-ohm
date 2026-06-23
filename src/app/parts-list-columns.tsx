"use client";

import {
  createColumnHelper,
  type ColumnDef
} from "@tanstack/react-table";

import type { PartsListItem } from "@/server/parts/getParts";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { ListColumnDefinition } from "@/app/list-table-config";
import {
  compareNumericDisplayValues,
  compareQuantityDisplayValues
} from "@/app/parts-list-sort-utils";
import { EmptyCell } from "@/app/list-table-cell";

// ---------------------------------------------------------------------------
// Copy types
// ---------------------------------------------------------------------------

export type PartsListCategoriesCopy = {
  noCategory: string;
};

export type PartsListColumnsCopy = PartsListCategoriesCopy & {
  categories: string;
  manufacturer: string;
  catalogNumber: string;
  description: string;
  value: string;
  stock: string;
  planned: string;
  onOrder: string;
  avgNetCost: string;
  avgGrossCost: string;
  defaultLocation: string;
  // Full-mode action button labels
  editPart?: string;
  deletePart?: string;
  addToPurchaseOrder?: string;
  addToShoppingList?: string;
};

// ---------------------------------------------------------------------------
// PartCategoriesSummary helper
// ---------------------------------------------------------------------------

export function PartCategoriesSummary({
  copy,
  part
}: {
  copy: PartsListCategoriesCopy;
  part: PartsListItem;
}) {
  if (!part.primaryCategoryPath && !part.secondaryCategoryPath) {
    return <span className="text-slate-400">{copy.noCategory}</span>;
  }

  return (
    <div className="grid gap-1">
      {part.primaryCategoryPath ? (
        <span>{part.primaryCategoryPath}</span>
      ) : null}
      {part.secondaryCategoryPath &&
      part.secondaryCategoryPath !== part.primaryCategoryPath ? (
        <span className="text-slate-500">{part.secondaryCategoryPath}</span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column definition metadata (for useListTableConfiguration)
// ---------------------------------------------------------------------------

type BuildColumnDefsOpts = {
  copy: Pick<
    PartsListColumnsCopy,
    | "categories"
    | "manufacturer"
    | "catalogNumber"
    | "description"
    | "value"
    | "stock"
    | "planned"
    | "onOrder"
    | "avgNetCost"
    | "avgGrossCost"
    | "defaultLocation"
  >;
  canReadInventory: boolean;
  canReadShoppingLists: boolean;
  canReadPurchaseOrders: boolean;
  workspaceAttributes: AttributeListItem[];
};

export function buildPartsListColumnDefs({
  copy,
  canReadInventory,
  canReadShoppingLists,
  canReadPurchaseOrders,
  workspaceAttributes
}: BuildColumnDefsOpts): ListColumnDefinition[] {
  const attributeColumnDefs: ListColumnDefinition[] = workspaceAttributes.map(
    (attribute) => ({
      id: `attribute:${attribute.id}`,
      label: attribute.name,
      group: "attribute" as const,
      defaultVisible: false,
      defaultWidth: 160,
      minWidth: 80,
      sortable: true,
      align: "center" as const
    })
  );

  return [
    {
      id: "categories",
      label: copy.categories,
      group: "base" as const,
      defaultWidth: 300,
      minWidth: 120
    },
    {
      id: "manufacturerName",
      label: copy.manufacturer,
      group: "base" as const,
      defaultWidth: 160,
      minWidth: 72,
      sortable: true
    },
    {
      id: "catalogNumber",
      label: copy.catalogNumber,
      group: "base" as const,
      defaultWidth: 190,
      minWidth: 64,
      sortable: true
    },
    {
      id: "description",
      label: copy.description,
      group: "base" as const,
      defaultWidth: 360,
      minWidth: 96,
      sortable: true
    },
    {
      id: "valueDisplayValue",
      label: copy.value,
      group: "base" as const,
      defaultWidth: 110,
      minWidth: 64,
      sortable: true,
      align: "center" as const
    },
    ...(canReadInventory
      ? [
          {
            id: "currentStock",
            label: copy.stock,
            group: "base" as const,
            defaultWidth: 120,
            minWidth: 72,
            sortable: true,
            align: "right" as const
          }
        ]
      : []),
    ...(canReadShoppingLists
      ? [
          {
            id: "plannedQuantity",
            label: copy.planned,
            group: "base" as const,
            defaultVisible: false,
            defaultWidth: 120,
            minWidth: 72,
            sortable: true,
            align: "right" as const
          }
        ]
      : []),
    ...(canReadPurchaseOrders
      ? [
          {
            id: "onOrderQuantity",
            label: copy.onOrder,
            group: "base" as const,
            defaultVisible: false,
            defaultWidth: 120,
            minWidth: 72,
            sortable: true,
            align: "right" as const
          },
          {
            id: "avgNetCost",
            label: copy.avgNetCost,
            group: "base" as const,
            defaultVisible: false,
            defaultWidth: 140,
            minWidth: 80,
            sortable: true,
            align: "right" as const
          },
          {
            id: "avgGrossCost",
            label: copy.avgGrossCost,
            group: "base" as const,
            defaultVisible: false,
            defaultWidth: 140,
            minWidth: 80,
            sortable: true,
            align: "right" as const
          }
        ]
      : []),
    {
      id: "defaultLocationName",
      label: copy.defaultLocation,
      group: "base" as const,
      defaultVisible: false,
      defaultWidth: 160,
      minWidth: 80
    },
    ...attributeColumnDefs
  ];
}

// ---------------------------------------------------------------------------
// TanStack column definitions (for useReactTable)
// ---------------------------------------------------------------------------

type CommonOpts = {
  copy: PartsListColumnsCopy;
  canReadInventory: boolean;
  canReadShoppingLists: boolean;
  canReadPurchaseOrders: boolean;
  workspaceAttributes: AttributeListItem[];
};

type FullModeOpts = CommonOpts & {
  mode: "full";
  isDatabaseAvailable: boolean;
  isDeletePending: boolean;
  canWriteShoppingLists: boolean;
  canWritePurchaseOrders: boolean;
  onEditPart: (part: PartsListItem) => void;
  onDeletePart: (part: PartsListItem) => void;
  onAddToPO?: (part: PartsListItem) => void;
  onAddToSL?: (part: PartsListItem) => void;
};

type PickerModeOpts = CommonOpts & {
  mode: "picker";
  selectedPartIds: ReadonlySet<string>;
  alreadyAddedPartIds: ReadonlySet<string>;
  onToggle: (partId: string) => void;
};

export function buildPartsListColumns(
  opts: FullModeOpts | PickerModeOpts
): ColumnDef<PartsListItem>[] {
  const {
    copy,
    canReadInventory,
    canReadShoppingLists,
    canReadPurchaseOrders,
    workspaceAttributes
  } = opts;

  const columnHelper = createColumnHelper<PartsListItem>();

  const attributeColumns = workspaceAttributes.map((attribute) =>
    columnHelper.accessor(
      (row) =>
        row.attributeValues.find(
          (attributeValue) => attributeValue.attributeId === attribute.id
        )?.displayValue ?? "",
      {
        id: `attribute:${attribute.id}`,
        header: attribute.name,
        size: 160,
        minSize: 80,
        sortingFn: (rowA, rowB) => {
          const valueA =
            rowA.original.attributeValues.find(
              (attributeValue) => attributeValue.attributeId === attribute.id
            )?.displayValue ?? "";
          const valueB =
            rowB.original.attributeValues.find(
              (attributeValue) => attributeValue.attributeId === attribute.id
            )?.displayValue ?? "";

          if (attribute.type === "QUANTITY") {
            return compareQuantityDisplayValues(valueA, valueB);
          }

          if (attribute.type === "NUMBER") {
            return compareNumericDisplayValues(valueA, valueB);
          }

          return valueA.localeCompare(valueB, "en", { sensitivity: "base", numeric: true });
        },
        cell: ({ getValue }) => {
          const value = getValue();

          return value ? (
            <span className="text-slate-700">{value}</span>
          ) : (
            <EmptyCell />
          );
        }
      }
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataColumns: ColumnDef<PartsListItem, any>[] = [
    columnHelper.display({
      id: "categories",
      header: copy.categories,
      size: 300,
      minSize: 120,
      cell: ({ row }) => (
        <PartCategoriesSummary copy={copy} part={row.original} />
      )
    }),
    columnHelper.accessor("manufacturerName", {
      header: copy.manufacturer,
      size: 160,
      minSize: 72,
      cell: ({ getValue }) => (
        <span className="text-slate-950">{getValue()}</span>
      )
    }),
    columnHelper.accessor("catalogNumber", {
      header: copy.catalogNumber,
      size: 190,
      minSize: 64,
      cell: ({ getValue }) => (
        <span className="font-mono text-slate-950">{getValue()}</span>
      )
    }),
    columnHelper.accessor("description", {
      header: copy.description,
      size: 360,
      minSize: 96,
      cell: ({ getValue }) => {
        const value = getValue();

        return value ? (
          <span className="text-slate-700">{value}</span>
        ) : (
          <EmptyCell />
        );
      }
    }),
    columnHelper.accessor("valueDisplayValue", {
      header: copy.value,
      size: 110,
      minSize: 64,
      sortingFn: (rowA, rowB) =>
        compareQuantityDisplayValues(
          rowA.original.valueDisplayValue ?? "",
          rowB.original.valueDisplayValue ?? ""
        ),
      cell: ({ getValue }) => {
        const value = getValue();

        return value ? (
          <span className="text-slate-950">{value}</span>
        ) : (
          <EmptyCell />
        );
      }
    }),
    ...(canReadInventory
      ? [
          columnHelper.accessor("currentStock", {
            header: () => (
              <span className="block w-full text-right">{copy.stock}</span>
            ),
            size: 120,
            minSize: 72,
            sortingFn: (rowA, rowB) =>
              compareNumericDisplayValues(
                rowA.original.currentStock ?? "",
                rowB.original.currentStock ?? ""
              ),
            cell: ({ getValue }) => {
              const value = getValue();

              return value ? (
                <span className="block text-right text-slate-950">{value}</span>
              ) : (
                <span className="block text-right"><EmptyCell /></span>
              );
            }
          })
        ]
      : []),
    ...(canReadShoppingLists
      ? [
          columnHelper.accessor("plannedQuantity", {
            header: () => (
              <span className="block w-full text-right">{copy.planned}</span>
            ),
            size: 120,
            minSize: 72,
            sortingFn: (rowA, rowB) =>
              compareNumericDisplayValues(
                rowA.original.plannedQuantity ?? "",
                rowB.original.plannedQuantity ?? ""
              ),
            cell: ({ getValue }) => {
              const value = getValue();

              return value ? (
                <span className="block text-right text-slate-950">{value}</span>
              ) : (
                <span className="block text-right"><EmptyCell /></span>
              );
            }
          })
        ]
      : []),
    ...(canReadPurchaseOrders
      ? [
          columnHelper.accessor("onOrderQuantity", {
            header: () => (
              <span className="block w-full text-right">{copy.onOrder}</span>
            ),
            size: 120,
            minSize: 72,
            sortingFn: (rowA, rowB) =>
              compareNumericDisplayValues(
                rowA.original.onOrderQuantity ?? "",
                rowB.original.onOrderQuantity ?? ""
              ),
            cell: ({ getValue }) => {
              const value = getValue();

              return value ? (
                <span className="block text-right text-slate-950">{value}</span>
              ) : (
                <span className="block text-right"><EmptyCell /></span>
              );
            }
          }),
          columnHelper.accessor("avgNetCost", {
            id: "avgNetCost",
            header: () => (
              <span className="block w-full text-right">{copy.avgNetCost}</span>
            ),
            size: 140,
            minSize: 80,
            cell: ({ getValue }) => {
              const value = getValue();
              return value ? (
                <span className="block text-right font-mono text-slate-700">
                  {value}
                </span>
              ) : (
                <span className="block text-right"><EmptyCell /></span>
              );
            }
          }),
          columnHelper.accessor("avgGrossCost", {
            id: "avgGrossCost",
            header: () => (
              <span className="block w-full text-right">
                {copy.avgGrossCost}
              </span>
            ),
            size: 140,
            minSize: 80,
            cell: ({ getValue }) => {
              const value = getValue();
              return value ? (
                <span className="block text-right font-mono text-slate-700">
                  {value}
                </span>
              ) : (
                <span className="block text-right"><EmptyCell /></span>
              );
            }
          })
        ]
      : []),
    columnHelper.accessor("defaultLocationName", {
      header: () => copy.defaultLocation,
      size: 160,
      minSize: 80,
      cell: ({ getValue }) => {
        const value = getValue();
        return value ? (
          <span className="text-slate-950">{value}</span>
        ) : (
          <EmptyCell />
        );
      }
    }),
    ...attributeColumns
  ];

  if (opts.mode === "picker") {
    const { selectedPartIds, alreadyAddedPartIds, onToggle } = opts;

    const selectColumn = columnHelper.display({
      id: "select",
      header: "",
      size: 48,
      minSize: 48,
      maxSize: 48,
      enableResizing: false,
      cell: ({ row }) => {
        const partId = row.original.id;
        const isChecked = selectedPartIds.has(partId);
        const isAlreadyAdded = alreadyAddedPartIds.has(partId);

        return (
          <div className="flex items-center justify-center px-1">
            <input
              aria-label={row.original.catalogNumber}
              checked={isChecked}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[var(--color-accent)]"
              type="checkbox"
              onChange={() => onToggle(partId)}
            />
            {isAlreadyAdded && !isChecked ? (
              <span className="sr-only">Already added</span>
            ) : null}
          </div>
        );
      }
    });

    return [selectColumn, ...dataColumns];
  }

  // Full mode
  const {
    isDatabaseAvailable,
    isDeletePending,
    canWriteShoppingLists,
    canWritePurchaseOrders,
    onEditPart,
    onDeletePart,
    onAddToPO,
    onAddToSL
  } = opts;

  const actionsColumn = columnHelper.display({
    id: "actions",
    header: "",
    size:
      104 +
      (canWritePurchaseOrders ? 48 : 0) +
      (canWriteShoppingLists ? 48 : 0),
    minSize:
      104 +
      (canWritePurchaseOrders ? 48 : 0) +
      (canWriteShoppingLists ? 48 : 0),
    maxSize:
      104 +
      (canWritePurchaseOrders ? 48 : 0) +
      (canWriteShoppingLists ? 48 : 0),
    enableResizing: false,
    cell: ({ row }) => (
      <div className="flex justify-end gap-2">
        <button
          className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          aria-label={copy.editPart}
          disabled={!isDatabaseAvailable}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEditPart(row.original);
          }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {canWritePurchaseOrders && onAddToPO ? (
          <button
            className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            aria-label={copy.addToPurchaseOrder}
            disabled={!isDatabaseAvailable}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddToPO(row.original);
            }}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 4h2l2.5 8h7l2-5.5H6.5M8 15.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm5.5 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {canWriteShoppingLists && onAddToSL ? (
          <button
            className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            aria-label={copy.addToShoppingList}
            disabled={!isDatabaseAvailable}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddToSL(row.original);
            }}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 5h10M5 8h6M5 11h4M13 11v6m-3-3h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <button
          className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-white px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          aria-label={copy.deletePart}
          disabled={!isDatabaseAvailable || isDeletePending}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDeletePart(row.original);
          }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    )
  });

  return [...dataColumns, actionsColumn];
}
