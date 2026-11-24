/**
 * The choices the workspace forms offer, shared by the server actions and the API operations
 * (#286). Pure, so unit tests and the OpenAPI document can load it.
 */

/** ISO 4217 codes a workspace's primary currency may take. */
export const SUPPORTED_WORKSPACE_CURRENCIES = [
  "EUR", "USD", "GBP", "PLN", "CZK", "CHF", "SEK", "DKK", "NOK",
  "HUF", "RON", "BGN", "HRK", "RUB", "JPY", "CNY", "CAD", "AUD"
] as const;

export type WorkspaceCurrency = (typeof SUPPORTED_WORKSPACE_CURRENCIES)[number];

export function isSupportedWorkspaceCurrency(value: string): value is WorkspaceCurrency {
  return (SUPPORTED_WORKSPACE_CURRENCIES as readonly string[]).includes(value);
}

/**
 * What a new workspace starts with: nothing, the starter dictionaries, or one of the demo presets
 * (dictionaries plus sample parts, and for `parts-and-orders` purchase orders and shopping lists).
 */
export const WORKSPACE_CREATION_PRESETS = [
  "empty",
  "starter-dictionaries",
  "parts-only",
  "parts-and-orders"
] as const;

export type WorkspaceCreationPreset = (typeof WORKSPACE_CREATION_PRESETS)[number];

export function toWorkspaceCreationPreset(value: string): WorkspaceCreationPreset {
  return (WORKSPACE_CREATION_PRESETS as readonly string[]).includes(value)
    ? (value as WorkspaceCreationPreset)
    : "empty";
}
