"use client";

import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { HoverPopover, Tooltip } from "@/app/floating";
import { useWorkspaceSlug } from "@/app/workspace-context";
import {
  getPartPreviewForWorkspace,
  getPurchaseOrderPreviewForWorkspace,
  getShoppingListPreviewForWorkspace,
  type EntityPreviewActionResult
} from "@/server/entity-previews/entityPreviewActions";

// User-facing copy of the hover previews (#123), kept together so it can be localized later.
const previewCopy = {
  loading: "Loading…",
  unavailable: "Preview unavailable.",
  notFound: "Not found.",
  noDescription: "No description",
  manufacturer: "Manufacturer",
  catalogNumber: "Catalog number",
  description: "Description",
  orderNumber: "Order number",
  supplier: "Supplier",
  status: "Status",
  items: "Items",
  name: "Name",
  statusDraft: "Draft",
  statusOrdered: "Ordered",
  statusReceived: "Received"
};

type PreviewField = { label: string; value: string };

/** How long a fetched preview is reused before hovering the link again refetches it. */
const PREVIEW_STALE_TIME_MS = 30_000;

function EntityPreview<T>({
  queryKey,
  load,
  toFields
}: {
  queryKey: readonly unknown[];
  load: () => Promise<EntityPreviewActionResult<T>>;
  toFields: (data: T) => PreviewField[];
}) {
  const query = useQuery({
    queryKey: ["entity-preview", ...queryKey],
    queryFn: async () => {
      const result = await load();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: PREVIEW_STALE_TIME_MS,
    retry: false
  });

  if (query.isPending) {
    return <p className="text-[var(--color-text-muted)]">{previewCopy.loading}</p>;
  }
  if (query.isError) {
    return <p className="text-[var(--color-text-muted)]">{previewCopy.unavailable}</p>;
  }
  if (query.data === null) {
    return <p className="text-[var(--color-text-muted)]">{previewCopy.notFound}</p>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {toFields(query.data).map((field) => (
        <div key={field.label} className="contents">
          <dt className="text-[var(--color-text-muted)]">{field.label}</dt>
          <dd className="min-w-0 break-words">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function purchaseOrderStatusLabel(status: "DRAFT" | "ORDERED" | "RECEIVED") {
  if (status === "DRAFT") return previewCopy.statusDraft;
  if (status === "ORDERED") return previewCopy.statusOrdered;
  return previewCopy.statusReceived;
}

type EntityLinkProps = {
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Shown in a popover while the link icon is hovered (#123). */
  preview?: ReactNode;
};

function EntityLink({ label, href, onClick, preview }: EntityLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else {
      window.location.href = href;
    }
  }

  const button = (
    <button
      type="button"
      aria-label={`Go to ${label}`}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-accent)] focus:opacity-100 focus:outline-none"
      onClick={handleClick}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
        <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
      </svg>
    </button>
  );

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      {preview ? (
        <HoverPopover content={preview}>{button}</HoverPopover>
      ) : (
        <Tooltip label={`Go to ${label}`}>{button}</Tooltip>
      )}
    </span>
  );
}

export function PartLink({
  partId,
  name,
  onClick
}: {
  partId: string;
  name: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const workspaceSlug = useWorkspaceSlug();
  const href = `/w/${encodeURIComponent(workspaceSlug)}/parts?selectedPartId=${partId}&pinnedId=${partId}`;
  return (
    <EntityLink
      label={name}
      href={href}
      onClick={onClick}
      preview={
        <EntityPreview
          queryKey={["part", workspaceSlug, partId]}
          load={() => getPartPreviewForWorkspace({ workspaceSlug, partId })}
          toFields={(part) => [
            { label: previewCopy.manufacturer, value: part.manufacturerName },
            { label: previewCopy.catalogNumber, value: part.catalogNumber },
            { label: previewCopy.description, value: part.description || previewCopy.noDescription }
          ]}
        />
      }
    />
  );
}

export function PoLink({
  poId,
  reference,
  onClick
}: {
  poId: string;
  reference: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const workspaceSlug = useWorkspaceSlug();
  const href = `/w/${encodeURIComponent(workspaceSlug)}/purchase-orders?selectedOrderId=${poId}&pinnedId=${poId}`;
  return (
    <EntityLink
      label={reference}
      href={href}
      onClick={onClick}
      preview={
        <EntityPreview
          queryKey={["purchase-order", workspaceSlug, poId]}
          load={() => getPurchaseOrderPreviewForWorkspace({ workspaceSlug, orderId: poId })}
          toFields={(order) => [
            ...(order.orderNumber ? [{ label: previewCopy.orderNumber, value: order.orderNumber }] : []),
            { label: previewCopy.supplier, value: order.supplierName },
            { label: previewCopy.status, value: purchaseOrderStatusLabel(order.status) },
            { label: previewCopy.items, value: String(order.itemCount) }
          ]}
        />
      }
    />
  );
}

export function SlLink({
  slId,
  name,
  onClick
}: {
  slId: string;
  name: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const workspaceSlug = useWorkspaceSlug();
  const href = `/w/${encodeURIComponent(workspaceSlug)}/shopping-lists?selectedListId=${slId}&pinnedId=${slId}`;
  return (
    <EntityLink
      label={name}
      href={href}
      onClick={onClick}
      preview={
        <EntityPreview
          queryKey={["shopping-list", workspaceSlug, slId]}
          load={() => getShoppingListPreviewForWorkspace({ workspaceSlug, listId: slId })}
          toFields={(list) => [
            { label: previewCopy.name, value: list.name },
            { label: previewCopy.description, value: list.description || previewCopy.noDescription },
            { label: previewCopy.items, value: String(list.itemCount) }
          ]}
        />
      }
    />
  );
}

export function BuildLink({
  buildId,
  label,
  onClick
}: {
  buildId: string;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const workspaceSlug = useWorkspaceSlug();
  const href = `/w/${encodeURIComponent(workspaceSlug)}/builds?selectedBuildId=${buildId}&pinnedId=${buildId}`;
  return <EntityLink label={label} href={href} onClick={onClick} />;
}
