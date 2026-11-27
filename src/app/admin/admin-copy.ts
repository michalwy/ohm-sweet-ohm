/** User-facing copy of the admin panel (#324), in one place so it can be localized later. */
export const adminCopy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  title: "Instance administration",
  intro: "Accounts, storage and registration for this whole instance.",
  backToWorkspaces: "Workspaces",
  backToAdmin: "Instance administration",
  registrationTitle: "Registration",
  registrationOpen: "Open: anyone can create an account.",
  registrationClosed: "Closed: only existing accounts can sign in.",
  registrationSourceConfig: (open: boolean) =>
    `Configuration default (OSO_AUTH_ALLOW_SIGN_UP is ${open ? "on" : "off"}).`,
  registrationSourceRuntime: (date: string) => `Set in this panel on ${date}; it overrides the configuration default.`,
  openRegistration: "Open registration",
  closeRegistration: "Close registration",
  storageTitle: "Storage",
  databaseSize: "Database size",
  storageNote:
    "Workspace figures count each workspace's rows; indexes and database overhead are not attributed, so they add up to less than the database size. A user's figure is the sum of the workspaces they belong to.",
  usersTitle: "Accounts",
  workspacesTitle: "Workspaces",
  columnEmail: "Email",
  columnName: "Name",
  columnCreated: "Created",
  columnWorkspaces: "Workspaces",
  columnOwned: "Owned",
  columnStorage: "Storage",
  columnWorkspace: "Workspace",
  columnUserRoles: "Roles",
  columnMembers: "Members",
  columnSolelyOwned: "Deleted with the data",
  adminBadge: "Administrator",
  archivedBadge: "Archived",
  yes: "Yes",
  no: "No",
  open: "Open",
  noWorkspaces: "This account is not a member of any workspace.",
  userTitle: (email: string) => email,
  userIntro: "The account, the workspaces it belongs to, and what deleting it removes.",
  deleteData: "Delete data",
  deleteUser: "Delete user",
  deleteDataTitle: "Delete this user's data?",
  deleteDataBody: (count: number) =>
    count === 0
      ? "The user solely owns no workspace, so nothing would be deleted. The account stays."
      : `This permanently deletes ${count} workspace${count === 1 ? "" : "s"} the user solely owns, with everything in them. The account and co-owned workspaces stay. This cannot be undone.`,
  deleteUserTitle: "Delete this user?",
  deleteUserBody:
    "This permanently deletes the account: its sessions, API tokens, connected apps and memberships, and every workspace it is the only member of. Records it created in shared workspaces stay. This cannot be undone.",
  deleteUserWithData: "Also delete every workspace this user solely owns, with everything in it",
  confirmInstruction: "Type the user's email to confirm:",
  confirmPlaceholder: "Email",
  delete: "Delete",
  close: "Close",
  cannotDeleteAdmin: "An instance administrator cannot be deleted here.",
  errors: {
    "not-instance-admin": "Only an instance administrator can do this.",
    "user-not-found": "This account no longer exists.",
    "cannot-delete-self": "You cannot delete your own account here.",
    "cannot-delete-instance-admin": "An instance administrator cannot be deleted.",
    unavailable: "The change could not be saved. Try again."
  } as Record<string, string>
};
