import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { adminCopy as copy } from "@/app/admin/admin-copy";
import {
  AdminHeader,
  adminCardClass,
  adminNumericClass,
  adminTableClass,
  adminTdClass,
  adminThClass
} from "@/app/admin/admin-header";
import { RegistrationToggle } from "@/app/admin/registration-toggle";
import { formatBytes } from "@/lib/formatBytes";
import { getStorageUsage } from "@/server/admin/adminStorage";
import { listAdminUsers } from "@/server/admin/adminUsers";
import { getSessionInstanceAdmin } from "@/server/admin/instanceAdmin";
import { getCurrentSession } from "@/server/auth/currentContext";
import { getRegistrationState } from "@/server/auth/registration";

export const dynamic = "force-dynamic";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** The instance admin panel (#324): accounts, storage and registration. Administrators only. */
export default async function AdminPage() {
  if (!(await getCurrentSession())) {
    redirect("/sign-in");
  }

  if (!(await getSessionInstanceAdmin())) {
    notFound();
  }

  const [users, storage, registration] = await Promise.all([
    listAdminUsers(),
    getStorageUsage(),
    getRegistrationState()
  ]);
  const userBytes = new Map(storage.users.map((user) => [user.id, user.bytes]));

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
        <AdminHeader backHref="/workspaces" backLabel={copy.backToWorkspaces} />

        <div className="py-6">
          <h1 className="text-2xl font-semibold tracking-normal">{copy.title}</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{copy.intro}</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <section aria-labelledby="admin-registration-heading" className={adminCardClass}>
            <h2 id="admin-registration-heading" className="text-lg font-semibold">
              {copy.registrationTitle}
            </h2>
            <p className="mt-2 text-sm font-medium">
              {registration.open ? copy.registrationOpen : copy.registrationClosed}
            </p>
            <p className="mt-1 mb-4 text-xs text-[var(--color-text-muted)]">
              {registration.source === "runtime" && registration.updatedAt
                ? copy.registrationSourceRuntime(isoDate(registration.updatedAt))
                : copy.registrationSourceConfig(registration.configDefault)}
            </p>
            <RegistrationToggle open={registration.open} />
          </section>

          <section aria-labelledby="admin-storage-heading" className={adminCardClass}>
            <h2 id="admin-storage-heading" className="text-lg font-semibold">
              {copy.storageTitle}
            </h2>
            <p className="mt-2 text-sm">
              {copy.databaseSize}:{" "}
              <span className="font-semibold tabular-nums">{formatBytes(storage.databaseBytes)}</span>
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{copy.storageNote}</p>
          </section>
        </div>

        <section aria-labelledby="admin-users-heading" className={`${adminCardClass} mt-6`}>
          <h2 id="admin-users-heading" className="mb-3 text-lg font-semibold">
            {copy.usersTitle}
          </h2>
          <table className={adminTableClass}>
            <thead>
              <tr>
                <th className={adminThClass}>{copy.columnEmail}</th>
                <th className={adminThClass}>{copy.columnName}</th>
                <th className={adminThClass}>{copy.columnCreated}</th>
                <th className={`${adminThClass} ${adminNumericClass}`}>{copy.columnWorkspaces}</th>
                <th className={`${adminThClass} ${adminNumericClass}`}>{copy.columnOwned}</th>
                <th className={`${adminThClass} ${adminNumericClass}`}>{copy.columnStorage}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className={adminTdClass}>
                    <Link
                      className="font-medium text-[var(--color-text-primary)] underline-offset-2 hover:underline"
                      href={`/admin/users/${user.id}`}
                    >
                      {user.email}
                    </Link>
                    {user.instanceAdmin ? (
                      <span className="ml-2 rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-xs font-medium">
                        {copy.adminBadge}
                      </span>
                    ) : null}
                  </td>
                  <td className={adminTdClass}>{user.name ?? ""}</td>
                  <td className={adminTdClass}>{isoDate(user.createdAt)}</td>
                  <td className={`${adminTdClass} ${adminNumericClass}`}>{user.workspaces.length}</td>
                  <td className={`${adminTdClass} ${adminNumericClass}`}>
                    {user.workspaces.filter((workspace) => workspace.owner).length}
                  </td>
                  <td className={`${adminTdClass} ${adminNumericClass}`}>
                    {formatBytes(userBytes.get(user.id) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="admin-workspaces-heading" className={`${adminCardClass} mt-6`}>
          <h2 id="admin-workspaces-heading" className="mb-3 text-lg font-semibold">
            {copy.workspacesTitle}
          </h2>
          <table className={adminTableClass}>
            <thead>
              <tr>
                <th className={adminThClass}>{copy.columnWorkspace}</th>
                <th className={`${adminThClass} ${adminNumericClass}`}>{copy.columnStorage}</th>
              </tr>
            </thead>
            <tbody>
              {storage.workspaces.map((workspace) => (
                <tr key={workspace.id}>
                  <td className={adminTdClass}>
                    <span className="font-medium text-[var(--color-text-primary)]">{workspace.name}</span>
                    <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">/w/{workspace.slug}</span>
                  </td>
                  <td className={`${adminTdClass} ${adminNumericClass}`}>{formatBytes(workspace.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
