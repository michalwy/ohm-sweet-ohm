import "server-only";

import { implementOperation } from "@/server/api/execute";
import { getRegistrationState, setRegistrationOpen, type RegistrationState } from "@/server/auth/registration";

import {
  adminDeleteUserDataOperation,
  adminDeleteUserOperation,
  adminGetRegistrationOperation,
  adminGetStorageUsageOperation,
  adminGetUserOperation,
  adminListUsersOperation,
  adminSetRegistrationOpenOperation
} from "./adminOperations";
import { getStorageUsage } from "./adminStorage";
import { deleteAdminUser, deleteAdminUserData, getAdminUser, listAdminUsers, type AdminUser } from "./adminUsers";
import { requireInstanceAdminActor } from "./instanceAdmin";

/** The admin MCP tools' implementations (#324); each checks the instance administrator first. */

export function toAdminUserOutput(user: AdminUser) {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

export function toRegistrationOutput(state: RegistrationState) {
  return { ...state, updatedAt: state.updatedAt?.toISOString() ?? null };
}

export const adminListUsersImplementation = implementOperation(adminListUsersOperation, async (actor) => {
  await requireInstanceAdminActor(actor, { write: false });

  return { users: (await listAdminUsers()).map(toAdminUserOutput) };
});

export const adminGetUserImplementation = implementOperation(adminGetUserOperation, async (actor, input) => {
  await requireInstanceAdminActor(actor, { write: false });

  return toAdminUserOutput(await getAdminUser(input.userId));
});

export const adminDeleteUserImplementation = implementOperation(
  adminDeleteUserOperation,
  async (actor, input) => {
    await requireInstanceAdminActor(actor, { write: true });

    return deleteAdminUser(actor.user.id, input.userId, { deleteData: input.deleteData });
  }
);

export const adminDeleteUserDataImplementation = implementOperation(
  adminDeleteUserDataOperation,
  async (actor, input) => {
    await requireInstanceAdminActor(actor, { write: true });

    return deleteAdminUserData(actor.user.id, input.userId);
  }
);

export const adminGetStorageUsageImplementation = implementOperation(
  adminGetStorageUsageOperation,
  async (actor) => {
    await requireInstanceAdminActor(actor, { write: false });

    return getStorageUsage();
  }
);

export const adminGetRegistrationImplementation = implementOperation(
  adminGetRegistrationOperation,
  async (actor) => {
    await requireInstanceAdminActor(actor, { write: false });

    return toRegistrationOutput(await getRegistrationState());
  }
);

export const adminSetRegistrationOpenImplementation = implementOperation(
  adminSetRegistrationOpenOperation,
  async (actor, input) => {
    await requireInstanceAdminActor(actor, { write: true });

    return toRegistrationOutput(await setRegistrationOpen(input.open, actor.user.id));
  }
);
