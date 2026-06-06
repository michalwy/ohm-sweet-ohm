import { notFound, redirect } from "next/navigation";

import { PurchaseOrdersClient } from "@/app/purchase-orders-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import { getPurchaseOrders } from "@/server/purchase-orders/purchaseOrderMutations";
import { getStorageLocations } from "@/server/inventory/locationMutations";

export const dynamic = "force-dynamic";

const copy = {
  title: "Purchase Orders",
  intro: "Formal orders sent to a supplier.",
  newOrder: "New order",
  newOrderTitle: "New purchase order",
  editOrderTitle: "Edit purchase order",
  supplier: "Supplier",
  chooseSupplier: "Choose a supplier",
  noSuppliers: "No organizations found. Create an organization first.",
  orderNumber: "Order number",
  orderNumberPlaceholder: "PO-2026-001",
  notes: "Notes",
  notesPlaceholder: "Optional notes",
  createOrder: "Create order",
  saveChanges: "Save changes",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "Only draft orders can be deleted. This cannot be undone.",
  deleteOrder: "Delete order",
  noOrders: "No purchase orders yet. Create one to start ordering parts.",
  loadError: "Failed to load orders.",
  loadingOrders: "Loading orders...",
  loadingMoreOrders: "Loading more...",
  status: "Status",
  statusDraft: "Draft",
  statusOrdered: "Ordered",
  statusReceived: "Received",
  markOrdered: "Mark as ordered",
  markOrderedConfirmTitle: "Mark as ordered?",
  markOrderedConfirmBody: "This will record the order date. You can still edit items after marking as ordered.",
  confirm: "Confirm",
  receiveItems: "Receive items",
  receiveItemsTitle: "Receive items",
  receiveItemsBody: "Enter quantities received and the destination location.",
  items: "item",
  itemsPlural: "items",
  ordered: "Ordered",
  received: "Received",
  remaining: "Remaining",
  part: "Part",
  quantity: "Qty ordered",
  receivedQty: "Qty to receive",
  location: "Location",
  chooseLocation: "Choose a location",
  noLocations: "No assignable locations available.",
  supplierSku: "Supplier SKU",
  unitPrice: "Unit price",
  currency: "Currency",
  lookupSku: "Look up",
  skuFound: "SKU found",
  skuNotFound: "Not found",
  addItem: "Add item",
  editItem: "Edit item",
  removeItem: "Remove item",
  removeItemConfirmBody: "This item will be removed from the order.",
  noItems: "No items yet. Add parts to this order.",
  searchParts: "Search parts",
  searchPartsPlaceholder: "Search by catalog number or description",
  noMatchingParts: "No matching parts",
  createdToast: "Order created",
  updatedToast: "Order updated",
  deletedToast: "Order deleted",
  orderedToast: "Order marked as ordered",
  itemAddedToast: "Item added",
  itemUpdatedToast: "Item updated",
  itemRemovedToast: "Item removed",
  receivedToast: "Items received",
  nameRequired: "Select a supplier.",
  quantityRequired: "Enter a quantity greater than zero.",
  partRequired: "Select a part.",
  locationRequired: "Choose a location.",
  invalidInput: "Check the fields and try again.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  orderedAt: "Ordered",
  noAttribute: "—",
  configureList: "Configure list",
  configureListTitle: "Configure list",
  configureListBody: "Choose visible columns, order, sorting, and widths.",
  visibleColumns: "Columns",
  moveUp: "Up",
  moveDown: "Down",
  columnWidthPx: "Width",
  sortingLabel: "Sort",
  clearSorting: "None",
  resetListConfiguration: "Reset defaults"
};

type PurchaseOrdersPageProps = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ selectedOrderId?: string }>;
};

export default async function PurchaseOrdersPage({ params, searchParams }: PurchaseOrdersPageProps) {
  const { workspaceSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const emptyPage = { items: [], nextCursor: null, totalCount: 0, filteredCount: 0 };

  const [initialPage, organizations, locations, canWrite] = await Promise.all([
    getPurchaseOrders(context.workspace.id).catch(() => emptyPage),
    prisma.organization
      .findMany({
        where: { workspaceId: context.workspace.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      })
      .catch(() => []),
    getStorageLocations(context.workspace.id).catch(() => []),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "purchase-orders:write"
    }).catch(() => false)
  ]);

  const assignableLocations = locations.filter((l) => l.isAssignable && !l.isArchived);

  return (
    <WorkspaceShell
      activeNavItem="purchase-orders"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <PurchaseOrdersClient
        copy={copy}
        canWrite={canWrite}
        initialPage={initialPage}
        initialSelectedOrderId={resolvedSearchParams?.selectedOrderId}
        organizations={organizations}
        assignableLocations={assignableLocations}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
