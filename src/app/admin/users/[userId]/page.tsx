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
import { AdminUserActions } from "@/app/admin/user-actions";
import { formatBytes } from "@/lib/formatBytes";
import { getStorageUsage } from "@/server/admin/adminStorage";
import { getAdminUser } from "@/server/admin/adminUsers";
import { getSessionInstanceAdmin } from "@/server/admin/instanceAdmin";
import { getCurrentSession } from "@/server/auth/currentContext";

export const dynamic = "force-dynamic";

/** One account in the instance admin panel (#324): its workspaces and the two deletions. */
export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  if (!(await getCurrentSession())) {
    redirect("/sign-in");
  }

  const admin = await getSessionInstanceAdmin();

  if (!admin) {
    notFound();
  }

  const { userId } = await params;
  const user = await getAdminUser(userId).catch(() => null);

  if (!user) {
    notFound();
  }

  const storage = await getStorageUsage();
  const workspaceBytes = new Map(storage.workspaces.map((workspace) => [workspace.id, workspace.bytes]));

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
        <AdminHeader backHref="/admin" backLabel={copy.backToAdmin} />

        <div className="flex items-end justify-between gap-4 py-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">
              {copy.userTitle(user.email)}
              {user.instanceAdmin ? (
                <span className="ml-3 rounded bg-[var(--color-accent-soft)] px-2 py-0.5 align-middle text-sm font-medium">
                  {copy.adminBadge}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              {user.name ? `${user.name} · ` : ""}
              {copy.columnCreated} {user.createdAt.toISOString().slice(0, 10)}
            </p>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{copy.userIntro}</p>
          </div>
          {user.instanceAdmin || user.id === admin.id ? (
            <p className="text-sm text-[var(--color-text-muted)]">{copy.cannotDeleteAdmin}</p>
          ) : (
            <AdminUserActions
              email={user.email}
              solelyOwnedCount={user.workspaces.filter((workspace) => workspace.solelyOwned).length}
              userId={user.id}
            />
          )}
        </div>

        <section aria-labelledby="admin-user-workspaces-heading" className={adminCardClass}>
          <h2 id="admin-user-workspaces-heading" className="mb-3 text-lg font-semibold">
            {copy.workspacesTitle}
          </h2>
          {user.workspaces.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{copy.noWorkspaces}</p>
          ) : (
            <table className={adminTableClass}>
              <thead>
                <tr>
                  <th className={adminThClass}>{copy.columnWorkspace}</th>
                  <th className={adminThClass}>{copy.columnUserRoles}</th>
                  <th className={`${adminThClass} ${adminNumericClass}`}>{copy.columnMembers}</th>
                  <th className={adminThClass}>{copy.columnSolelyOwned}</th>
                  <th className={`${adminThClass} ${adminNumericClass}`}>{copy.columnStorage}</th>
                </tr>
              </thead>
              <tbody>
                {user.workspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td className={adminTdClass}>
                      <span className="font-medium text-[var(--color-text-primary)]">{workspace.name}</span>
                      <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">/w/{workspace.slug}</span>
                      {workspace.archived ? (
                        <span className="ml-2 text-xs text-[var(--color-text-muted)]">{copy.archivedBadge}</span>
                      ) : null}
                    </td>
                    <td className={adminTdClass}>{workspace.roles.join(", ")}</td>
                    <td className={`${adminTdClass} ${adminNumericClass}`}>{workspace.memberCount}</td>
                    <td className={adminTdClass}>{workspace.solelyOwned ? copy.yes : copy.no}</td>
                    <td className={`${adminTdClass} ${adminNumericClass}`}>
                      {formatBytes(workspaceBytes.get(workspace.id) ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
