"use client";

import { useWorkspaceSlug } from "@/app/workspace-context";

type EntityLinkProps = {
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

function EntityLink({ label, href, onClick }: EntityLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else {
      window.location.href = href;
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
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
  return <EntityLink label={name} href={href} onClick={onClick} />;
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
  return <EntityLink label={reference} href={href} onClick={onClick} />;
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
  return <EntityLink label={name} href={href} onClick={onClick} />;
}
