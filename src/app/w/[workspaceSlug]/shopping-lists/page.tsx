import { notFound, redirect } from "next/navigation";

import { ShoppingListsClient } from "@/app/shopping-lists-client";
import { WorkspaceShell } from "@/app/workspace-shell";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import {
  getCurrentSession,
  getCurrentWorkspaceContextBySlug
} from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import { getShoppingLists } from "@/server/shopping-lists/shoppingListMutations";

export const dynamic = "force-dynamic";

const copy = {
  title: "Shopping Lists",
  intro: "Informal lists of parts you want to buy.",
  newList: "New list",
  newListTitle: "New shopping list",
  editListTitle: "Edit shopping list",
  name: "Name",
  notes: "Notes",
  namePlaceholder: "Weekend order",
  notesPlaceholder: "Optional notes",
  createList: "Create list",
  saveChanges: "Save changes",
  edit: "Edit",
  delete: "Delete",
  close: "Close",
  cancel: "Cancel",
  cancelDelete: "Cancel",
  confirmDelete: "Delete",
  deleteConfirmationBody: "This cannot be undone.",
  deleteList: "Delete list",
  noLists: "No shopping lists yet. Create one to start collecting parts to buy.",
  items: "item",
  itemsPlural: "items",
  openList: "Open",
  listItems: "Items",
  addItem: "Add item",
  editItem: "Edit item",
  removeItem: "Remove item",
  removeItemConfirmBody: "This item will be removed from the list.",
  part: "Part",
  quantity: "Quantity",
  noItems: "No items yet. Add parts to this list.",
  searchParts: "Search parts",
  searchPartsPlaceholder: "Search by catalog number or description",
  noMatchingParts: "No matching parts",
  orderedBadge: "On order",
  convertToOrder: "Convert to order",
  convertToOrderTitle: "Convert to purchase order",
  convertToOrderBody: "Select items to include and choose a supplier.",
  supplier: "Supplier",
  chooseSupplier: "Choose a supplier",
  noSuppliers: "No organizations found. Create an organization first.",
  selectedItems: "Selected items",
  noItemsSelected: "Select at least one item to convert.",
  convert: "Convert",
  createdToast: "List created",
  updatedToast: "List updated",
  deletedToast: "List deleted",
  itemAddedToast: "Item added",
  itemUpdatedToast: "Item updated",
  itemRemovedToast: "Item removed",
  convertedToast: "Purchase order created",
  nameRequired: "Enter a name.",
  quantityRequired: "Enter a quantity greater than zero.",
  partRequired: "Select a part.",
  supplierRequired: "Select a supplier.",
  invalidInput: "Check the fields and try again.",
  permissionDenied: "You do not have permission to perform this action.",
  databaseUnavailable: "Database is not available.",
  actions: "Actions"
};

type ShoppingListsPageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function ShoppingListsPage({ params }: ShoppingListsPageProps) {
  const { workspaceSlug } = await params;
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    notFound();
  }

  const [lists, organizations, canWrite] = await Promise.all([
    getShoppingLists(context.workspace.id).catch(() => []),
    prisma.organization
      .findMany({
        where: { workspaceId: context.workspace.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      })
      .catch(() => []),
    hasWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "shopping-lists:write"
    }).catch(() => false)
  ]);

  return (
    <WorkspaceShell
      activeNavItem="shopping-lists"
      intro={copy.intro}
      title={copy.title}
      userEmail={context.user.email}
      workspaceName={context.workspace.name}
      workspaceSlug={workspaceSlug}
    >
      <ShoppingListsClient
        copy={copy}
        canWrite={canWrite}
        initialLists={lists}
        organizations={organizations}
        workspaceSlug={workspaceSlug}
      />
    </WorkspaceShell>
  );
}
