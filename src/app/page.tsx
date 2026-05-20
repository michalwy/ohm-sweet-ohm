import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/currentContext";
import { getLastWorkspaceRedirectPath } from "@/server/workspaces/lastWorkspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  redirect(await getLastWorkspaceRedirectPath(session.user.id));
}
