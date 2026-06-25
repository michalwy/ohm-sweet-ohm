"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const WorkspaceContext = createContext<string | null>(null);

export function WorkspaceProvider({
  workspaceSlug,
  children
}: {
  workspaceSlug: string;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={workspaceSlug}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceSlug(): string {
  const slug = useContext(WorkspaceContext);
  if (!slug) throw new Error("useWorkspaceSlug must be used within a WorkspaceProvider");
  return slug;
}
