/** User-facing copy of Settings → Connected apps (#322), kept together so it can be localized. */
export const connectedAppsCopy = {
  title: "Connected apps",
  intro:
    "Apps you connected through OAuth, such as a claude.ai custom connector. Each acts as you, in one workspace, with the access you approved.",
  empty: "You have not connected any apps. Add OhmSweetOhm as a custom connector in claude.ai to connect one.",
  nameColumn: "App",
  workspaceColumn: "Workspace",
  accessColumn: "Access",
  connectedColumn: "Connected",
  lastUsedColumn: "Last used",
  notUsed: "Not used yet",
  accessReadOnly: "Read-only",
  accessReadWrite: "Read-write",
  disconnect: "Disconnect",
  disconnectTitle: "Disconnect",
  disconnectBody:
    "The app loses access at once and must be connected again to act. This cannot be undone.",
  cancel: "Cancel",
  close: "Close",
  errorGeneric: "Something went wrong. Please try again.",
  errorUnauthenticated: "You must be signed in to manage connected apps.",
  errorNotFound: "This app is no longer connected."
};

export type ConnectedAppsCopy = typeof connectedAppsCopy;
