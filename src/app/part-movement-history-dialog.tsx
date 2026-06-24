"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import type { InventoryHistoryItem } from "@/server/inventory/entryMutations";
import { getPartInventoryHistoryForWorkspace } from "@/server/inventory/entryActions";
import { useListTableConfiguration } from "@/app/list-table-config";
import type { ListColumnDefinition } from "@/app/list-table-config";
import {
  ListPageToolbar,
  ListTableHeaderCell,
  useColumnDragReorder,
  useColumnResizeCursor
} from "@/app/list-page-toolbar";
import {
  DialogBody,
  DialogFooter,
  DialogShell,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";

type Copy = {
  close: string;
  movementHistory: string;
  noHistory: string;
  loadingParts: string;
  databaseUnavailable: string;
  historyColType: string;
  historyColQuantity: string;
  historyColLocation: string;
  historyColDate: string;
  configureList: string;
  visibleColumns: string;
};

const columnHelper = createColumnHelper<InventoryHistoryItem>();

export function PartMovementHistoryDialog({
  open,
  onClose,
  workspaceSlug,
  partId,
  partTitle,
  copy
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  partId: string | null;
  partTitle: string;
  copy: Copy;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      openDialog(dialogRef.current);
    } else {
      closeDialog(dialogRef.current);
    }
  }, [open]);

  const historyQuery = useQuery({
    queryKey: ["part-inventory-history", workspaceSlug, partId],
    enabled: open && Boolean(partId),
    queryFn: async () => {
      const result = await getPartInventoryHistoryForWorkspace({
        workspaceSlug,
        partId: partId as string
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const columnDefs = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "type", label: copy.historyColType, defaultWidth: 130, minWidth: 80, sortable: true },
      { id: "quantity", label: copy.historyColQuantity, defaultWidth: 80, minWidth: 60, sortable: true, align: "right" },
      { id: "location", label: copy.historyColLocation, defaultWidth: 220, sortable: true },
      { id: "date", label: copy.historyColDate, defaultWidth: 160, sortable: true }
    ],
    [copy.historyColType, copy.historyColQuantity, copy.historyColLocation, copy.historyColDate]
  );

  const tableConfig = useListTableConfiguration({
    storageKey: "oso:list-config:part-movement-history",
    columns: columnDefs
  });

  const historyData = historyQuery.data ?? [];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: historyData,
    columns: useMemo(
      () => [
        columnHelper.accessor("entryType", {
          id: "type",
          header: () => copy.historyColType,
          enableSorting: true,
          sortingFn: "alphanumeric",
          cell: (info) => (
            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700">
              {info.getValue()}
            </span>
          )
        }),
        columnHelper.accessor("quantity", {
          id: "quantity",
          header: () => copy.historyColQuantity,
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            Number(rowA.original.quantity) - Number(rowB.original.quantity),
          cell: (info) => (
            <span className="font-semibold tabular-nums text-slate-950">
              {info.getValue()}
            </span>
          )
        }),
        columnHelper.accessor(
          (row) =>
            [row.fromLocationName, row.toLocationName].filter(Boolean).join(" → "),
          {
            id: "location",
            header: () => copy.historyColLocation,
            enableSorting: true,
            sortingFn: "alphanumeric",
            cell: (info) => (
              <div className="text-slate-600">
                <span>{info.getValue() || null}</span>
                {info.row.original.note ? (
                  <p className="text-xs text-slate-400">{info.row.original.note}</p>
                ) : null}
              </div>
            )
          }
        ),
        columnHelper.accessor("createdAt", {
          id: "date",
          header: () => copy.historyColDate,
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            new Date(rowA.original.createdAt).getTime() -
            new Date(rowB.original.createdAt).getTime(),
          cell: (info) => (
            <div className="whitespace-nowrap text-xs text-slate-400">
              {new Date(info.getValue()).toLocaleDateString()}
              {info.row.original.authorName ? (
                <p>{info.row.original.authorName}</p>
              ) : null}
            </div>
          )
        })
      ],
      [
        copy.historyColType,
        copy.historyColQuantity,
        copy.historyColLocation,
        copy.historyColDate
      ]
    ),
    state: {
      columnVisibility: tableConfig.columnVisibility,
      columnOrder: tableConfig.columnOrder,
      columnSizing: tableConfig.columnSizing,
      sorting: tableConfig.sorting
    },
    onColumnVisibilityChange: tableConfig.setColumnVisibility,
    onColumnOrderChange: tableConfig.setColumnOrder,
    onColumnSizingChange: tableConfig.setColumnSizing,
    onSortingChange: tableConfig.setSorting,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    manualSorting: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const { isResizingColumn, setIsResizingColumn, containerClassName } =
    useColumnResizeCursor();
  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } =
    useColumnDragReorder(tableConfig.setColumnOrder);

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.close}
      title={`${copy.movementHistory}: ${partTitle}`}
      titleId="movement-history-dialog-title"
      widthClassName="w-[min(60rem,calc(100vw-3rem))]"
      heightClassName="h-[calc(100vh-2rem)]"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onCloseClick={() => onClose()}
    >
      <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ListPageToolbar
            configurableColumns={tableConfig.configurableColumns}
            columnVisibility={tableConfig.columnVisibility}
            configureListLabel={copy.configureList}
            visibleColumnsLabel={copy.visibleColumns}
            setColumnVisible={tableConfig.setColumnVisible}
            primaryAction={null}
          />
          <div className={`flex-1 overflow-auto ${containerClassName}`}>
            {historyQuery.isLoading ? (
              <p className="px-4 py-6 text-sm text-slate-500">{copy.loadingParts}</p>
            ) : historyQuery.isError ? (
              <p className="px-4 py-6 text-sm text-slate-500">{copy.databaseUnavailable}</p>
            ) : historyData.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">{copy.noHistory}</p>
            ) : (
              <table
                className="table-fixed border-separate border-spacing-0 text-left text-sm"
                style={{ width: table.getTotalSize() }}
              >
                <colgroup>
                  {table.getVisibleLeafColumns().map((column) => (
                    <col key={column.id} style={{ width: column.getSize() }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <ListTableHeaderCell
                          key={header.id}
                          columnDefs={columnDefs}
                          draggedColumnId={draggedColumnId}
                          header={header}
                          isResizingColumn={isResizingColumn}
                          setColumnSorting={tableConfig.setColumnSorting}
                          setColumnWidth={tableConfig.setColumnWidth}
                          setIsResizingColumn={setIsResizingColumn}
                          onDragEnd={onDragEnd}
                          onDropOnto={onDropOnto}
                          onStartDrag={onStartDrag}
                        />
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      {row.getVisibleCells().map((cell) => {
                        const colDef = columnDefs.find((d) => d.id === cell.column.id);
                        const alignClass =
                          colDef?.align === "right"
                            ? "text-right"
                            : colDef?.align === "center"
                              ? "text-center"
                              : "";
                        return (
                          <td
                            key={cell.id}
                            className={`px-2 py-2.5 align-top text-sm ${alignClass}`}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="justify-end">
        <button
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          type="button"
          onClick={onClose}
        >
          {copy.close}
        </button>
      </DialogFooter>
    </DialogShell>
  );
}
