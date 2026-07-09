"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { analyzeShortageAction } from "@/server/designs/bomActions";
import type { ShortageAnalysis } from "@/server/designs/shortageAnalysis";
import {
  DialogBody,
  DialogFooter,
  DialogSecondaryButton,
  DialogShell,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import { ShortageToShoppingListDialog } from "@/app/shortage-to-sl-dialog";

export type ShortagePanelCopy = {
  heading: string;
  targetQuantity: string;
  selectRevision: string;
  loading: string;
  error: string;
  allInStock: string;
  lineShortagesHeading: string;
  designators: string;
  required: string;
  available: string;
  gap: string;
  noMatches: string;
  procurementHeading: string;
  catalogNumber: string;
  manufacturer: string;
  shortageQty: string;
  cyclesHeading: string;
  viaSubDesign: string;
  createSubBuild: string;
  createShoppingListFromShortage: string;
  // Compact status + modal
  statusSelectDesign: string;
  statusFulfillable: string;
  statusShortage: string;
  statusPending: string;
  openAnalysis: string;
  modalTitle: string;
  close: string;
};

export const DEFAULT_SHORTAGE_COPY: ShortagePanelCopy = {
  heading: "Shortage analysis",
  targetQuantity: "Target quantity",
  selectRevision: "Select a revision to analyze shortages.",
  loading: "Analyzing…",
  error: "Failed to analyze shortages.",
  allInStock: "All components can be fulfilled from available stock.",
  lineShortagesHeading: "Line shortages",
  designators: "Designators",
  required: "Required",
  available: "Available",
  gap: "Gap",
  noMatches: "No matching part",
  procurementHeading: "To acquire",
  catalogNumber: "Catalog #",
  manufacturer: "Manufacturer",
  shortageQty: "Shortage",
  cyclesHeading: "Design cycles detected",
  viaSubDesign: "via",
  createSubBuild: "Create build",
  createShoppingListFromShortage: "Create shopping list",
  statusSelectDesign: "Select a design and revision to check stock.",
  statusFulfillable: "This build can be made from available stock.",
  statusShortage: "This build cannot be fully made from available stock.",
  statusPending: "Checking stock…",
  openAnalysis: "Shortage analysis",
  modalTitle: "Shortage analysis",
  close: "Close"
};

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** A revision is fully fulfillable when nothing is short, unmatched, missing, or cyclic. */
export function isFulfillable(data: ShortageAnalysis): boolean {
  return (
    !data.lines.some((line) => line.gapQty > 0 || line.matchCount === 0) &&
    data.procurement.length === 0 &&
    data.cycles.length === 0
  );
}

export function useShortageAnalysis(
  workspaceSlug: string,
  revisionId: string | null,
  targetQuantity: number
): UseQueryResult<ShortageAnalysis | null> {
  const enabled =
    Boolean(revisionId) && Number.isInteger(targetQuantity) && targetQuantity >= 1;

  return useQuery<ShortageAnalysis | null>({
    queryKey: ["shortage", workspaceSlug, revisionId, targetQuantity],
    queryFn: async () => {
      if (!revisionId) return null;
      const result = await analyzeShortageAction({ workspaceSlug, revisionId, targetQuantity });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled
  });
}

// --- Result tables (shared by the inline design panel and the modal) ---

type SubBuildPrefill = { designId: string; revisionId: string; targetQuantity: number };

function ShortageResults({
  data,
  copy,
  workspaceSlug,
  canWriteShoppingLists,
  onToast,
  onCreateSubBuild
}: {
  data: ShortageAnalysis;
  copy: ShortagePanelCopy;
  workspaceSlug: string;
  canWriteShoppingLists: boolean;
  onToast: (msg: string) => void;
  onCreateSubBuild?: (prefill: SubBuildPrefill) => void;
}) {
  const [createSlDialogOpen, setCreateSlDialogOpen] = useState(false);

  return (
    <div className="grid gap-4">
      {data.cycles.length > 0 && (
        <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
          <p className="font-semibold">{copy.cyclesHeading}</p>
          <ul className="mt-1 list-disc pl-5">
            {data.cycles.map((cycle, index) => (
              <li key={index} className="font-mono text-xs">
                {cycle.path.join(" → ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {copy.lineShortagesHeading}
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-3 py-2 text-left">{copy.designators}</th>
              <th className="px-3 py-2 text-right">{copy.required}</th>
              <th className="px-3 py-2 text-right">{copy.available}</th>
              <th className="px-3 py-2 text-right">{copy.gap}</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => {
              const short = line.gapQty > 0;
              const unmatched = line.matchCount === 0;
              return (
                <tr key={line.lineItemId} className="border-b border-[var(--color-border)]">
                  <td className="px-3 py-2 font-mono text-[var(--color-text-primary)]">
                    {line.designators}
                    {unmatched && (
                      <span className="ml-2 rounded bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-xs text-[var(--color-warning)]">
                        {copy.noMatches}
                      </span>
                    )}
                    {!unmatched && line.sourcingDesignName && (
                      <span className="ml-2 inline-flex items-center gap-1.5">
                        <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-xs text-[var(--color-accent)]">
                          {copy.viaSubDesign} {line.sourcingDesignName}
                        </span>
                        {onCreateSubBuild && line.sourcingDesignId && line.sourcingLatestRevisionId && line.gapQty > 0 && (
                          <button
                            type="button"
                            className="rounded border border-[var(--color-accent)] px-1.5 py-0.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                            onClick={() =>
                              onCreateSubBuild({
                                designId: line.sourcingDesignId!,
                                revisionId: line.sourcingLatestRevisionId!,
                                targetQuantity: line.gapQty
                              })
                            }
                          >
                            {copy.createSubBuild}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">
                    {formatQty(line.requiredQty)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">
                    {formatQty(line.availableQty)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      short ? "text-[var(--color-error)]" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {formatQty(line.gapQty)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.procurement.length > 0 && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {copy.procurementHeading}
            </p>
            {canWriteShoppingLists && (
              <DialogSecondaryButton type="button" onClick={() => setCreateSlDialogOpen(true)}>
                {copy.createShoppingListFromShortage}
              </DialogSecondaryButton>
            )}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-3 py-2 text-left">{copy.catalogNumber}</th>
                <th className="px-3 py-2 text-left">{copy.manufacturer}</th>
                <th className="px-3 py-2 text-right">{copy.shortageQty}</th>
              </tr>
            </thead>
            <tbody>
              {data.procurement.map((item) => (
                <tr key={item.partId} className="border-b border-[var(--color-border)]">
                  <td className="px-3 py-2 font-mono text-[var(--color-text-primary)]">
                    {item.catalogNumber}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {item.manufacturerName}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--color-error)]">
                    {formatQty(item.shortageQty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canWriteShoppingLists && (
        <ShortageToShoppingListDialog
          open={createSlDialogOpen}
          onClose={() => setCreateSlDialogOpen(false)}
          workspaceSlug={workspaceSlug}
          procurement={data.procurement}
          onSuccess={onToast}
        />
      )}
    </div>
  );
}

function ShortageBody({
  query,
  revisionId,
  copy,
  workspaceSlug,
  canWriteShoppingLists,
  onToast,
  onCreateSubBuild
}: {
  query: UseQueryResult<ShortageAnalysis | null>;
  revisionId: string | null;
  copy: ShortagePanelCopy;
  workspaceSlug: string;
  canWriteShoppingLists: boolean;
  onToast: (msg: string) => void;
  onCreateSubBuild?: (prefill: SubBuildPrefill) => void;
}) {
  const { data, isFetching, isError } = query;
  if (!revisionId) {
    return <p className="text-sm text-[var(--color-text-muted)]">{copy.selectRevision}</p>;
  }
  if (isError) {
    return <p className="text-sm text-[var(--color-error)]">{copy.error}</p>;
  }
  if (isFetching && !data) {
    return <p className="text-sm text-[var(--color-text-muted)]">{copy.loading}</p>;
  }
  if (!data) return null;
  if (isFulfillable(data)) {
    return <p className="text-sm text-[var(--color-success)]">{copy.allInStock}</p>;
  }
  return (
    <ShortageResults
      data={data}
      copy={copy}
      workspaceSlug={workspaceSlug}
      canWriteShoppingLists={canWriteShoppingLists}
      onToast={onToast}
      onCreateSubBuild={onCreateSubBuild}
    />
  );
}

// --- Inline panel (Design revision details) ---

type ShortagePanelProps = {
  workspaceSlug: string;
  revisionId: string | null;
  targetQuantity: number;
  onTargetQuantityChange?: (value: number) => void;
  canWriteShoppingLists: boolean;
  onToast: (msg: string) => void;
  copy?: ShortagePanelCopy;
};

export function ShortagePanel({
  workspaceSlug,
  revisionId,
  targetQuantity,
  onTargetQuantityChange,
  canWriteShoppingLists,
  onToast,
  copy = DEFAULT_SHORTAGE_COPY
}: ShortagePanelProps) {
  const query = useShortageAnalysis(workspaceSlug, revisionId, targetQuantity);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {copy.heading}
        </p>
        {onTargetQuantityChange && (
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            {copy.targetQuantity}
            <input
              className="w-20 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
              type="number"
              min={1}
              step={1}
              value={targetQuantity}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                onTargetQuantityChange(Number.isNaN(next) ? 1 : Math.max(1, next));
              }}
            />
          </label>
        )}
      </div>
      <ShortageBody
        query={query}
        revisionId={revisionId}
        copy={copy}
        workspaceSlug={workspaceSlug}
        canWriteShoppingLists={canWriteShoppingLists}
        onToast={onToast}
      />
    </section>
  );
}

// --- Compact status row (build create dialog) ---

type ShortageStatusProps = {
  workspaceSlug: string;
  revisionId: string | null;
  targetQuantity: number;
  onOpen: () => void;
  copy?: ShortagePanelCopy;
};

export function ShortageStatus({
  workspaceSlug,
  revisionId,
  targetQuantity,
  onOpen,
  copy = DEFAULT_SHORTAGE_COPY
}: ShortageStatusProps) {
  const { data, isFetching, isError } = useShortageAnalysis(
    workspaceSlug,
    revisionId,
    targetQuantity
  );

  let text = copy.statusSelectDesign;
  let toneClass = "text-[var(--color-text-muted)]";
  let dotClass = "bg-[var(--color-text-muted)]";

  if (revisionId) {
    if (isError) {
      text = copy.error;
      toneClass = "text-[var(--color-error)]";
      dotClass = "bg-[var(--color-error)]";
    } else if (!data || isFetching) {
      text = copy.statusPending;
    } else if (isFulfillable(data)) {
      text = copy.statusFulfillable;
      toneClass = "text-[var(--color-success)]";
      dotClass = "bg-[var(--color-success)]";
    } else {
      text = copy.statusShortage;
      toneClass = "text-[var(--color-error)]";
      dotClass = "bg-[var(--color-error)]";
    }
  }

  const hasShortage = Boolean(revisionId) && data != null && !isError && !isFulfillable(data);

  return (
    <div className="flex h-9 items-center gap-3">
      <span className={`flex min-w-0 items-center gap-2 text-sm ${toneClass}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
        <span className="truncate">{text}</span>
      </span>
      {hasShortage && (
        <button
          type="button"
          className="shrink-0 text-sm text-[var(--color-accent)] underline hover:no-underline"
          onClick={onOpen}
        >
          {copy.openAnalysis}
        </button>
      )}
    </div>
  );
}

// --- Full analysis modal ---

type ShortageAnalysisModalProps = {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  revisionId: string | null;
  targetQuantity: number;
  canWriteShoppingLists: boolean;
  onToast: (msg: string) => void;
  onCreateSubBuild?: (prefill: SubBuildPrefill) => void;
  copy?: ShortagePanelCopy;
};

export function ShortageAnalysisModal({
  open,
  onClose,
  workspaceSlug,
  revisionId,
  targetQuantity,
  canWriteShoppingLists,
  onToast,
  onCreateSubBuild,
  copy = DEFAULT_SHORTAGE_COPY
}: ShortageAnalysisModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const query = useShortageAnalysis(workspaceSlug, revisionId, targetQuantity);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) openDialog(dialog);
    else if (!open && dialog.open) closeDialog(dialog);
  }, [open]);

  if (!open) return null;

  return (
    <DialogShell
      ref={dialogRef}
      closeLabel={copy.close}
      title={copy.modalTitle}
      titleId="shortage-analysis-dialog-title"
      widthClassName="w-[min(48rem,calc(100vw-3rem))]"
      heightClassName="h-[min(40rem,calc(100vh-2rem))]"
      onClose={onClose}
      onCloseClick={onClose}
    >
      <DialogBody className="grow">
        <ShortageBody
          query={query}
          revisionId={revisionId}
          copy={copy}
          workspaceSlug={workspaceSlug}
          canWriteShoppingLists={canWriteShoppingLists}
          onToast={onToast}
          onCreateSubBuild={onCreateSubBuild}
        />
      </DialogBody>
      <DialogFooter>
        <DialogSecondaryButton type="button" onClick={onClose}>
          {copy.close}
        </DialogSecondaryButton>
      </DialogFooter>
    </DialogShell>
  );
}
