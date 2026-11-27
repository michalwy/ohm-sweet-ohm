/** User-facing copy of the connector consent screen (#322), kept together so it can be localized. */
export const oauthConsentCopy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  title: "Connect an app",
  intro: "{app} wants to use OhmSweetOhm as you, through its MCP tools.",
  redirectNote: "After you answer, you go back to {host}.",
  warning:
    "Only approve an app you are adding yourself, for example a custom connector you just added in claude.ai.",
  workspaceLabel: "Workspace",
  workspaceHelp: "The app acts in this workspace only.",
  accessLabel: "Access",
  accessReadOnly: "Read-only",
  accessReadOnlyHelp: "Read everything you can read in the workspace.",
  accessReadWrite: "Read-write",
  accessReadWriteHelp: "Read and change everything you can in the workspace.",
  approve: "Approve",
  deny: "Deny",
  settingsNote: "You can disconnect it at any time in Settings → Connected apps.",
  noWorkspaces: "You have no active workspace to connect. Create one first, then add the app again.",
  goToWorkspaces: "Go to workspaces",
  errorTitle: "This request cannot be completed",
  errors: {
    "unknown-client": "The app is not registered here. Remove it in the app and add it again.",
    "invalid-redirect-uri": "The app sent a return address it did not register.",
    "workspace-not-found": "Choose one of your active workspaces.",
    "invalid-access": "Choose an access level.",
    "signed-out": "Your session ended. Sign in and try again.",
    generic: "Something went wrong. Please try again."
  } as Record<string, string>
};

export type OAuthConsentCopy = typeof oauthConsentCopy;
