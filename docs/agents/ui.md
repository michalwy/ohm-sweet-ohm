# UI direction

- **Desktop only.** Do not design, implement or test mobile layouts, responsive mobile breakpoints,
  mobile navigation patterns or mobile-specific fallbacks unless a future product decision reverses
  this.
- Use modal dialogs for list actions such as adding, editing and similar focused workflows.
- Build dialogs with the shared `src/app/dialog-shell.tsx` primitives. Do not duplicate the dialog
  header, close button, viewport constraint or default-tab height behavior in feature components;
  extend the shared shell first when a dialog needs a new common capability.
- Tabs inside a dialog are visual grouping only. A dialog has one logical save action that persists
  values from all tabs and closes the dialog when the save succeeds.
- A dialog's height is set by its primary/default tab. It may be constrained by the viewport; when
  content exceeds it, only the dialog body scrolls while header and footer stay fixed. Switching tabs
  must not change the dialog height.
- Prefer in-place editing on lists where inline edits are practical and clear.
- Build list screens on shared base components for loading state, empty state, filters, table layout
  and endless scrolling. Extend the shared primitives first when several lists need the same
  capability.
- Reserve URL state for navigation, filters, sorting, pagination, selected records and deep-linkable
  UI. Never put ephemeral success feedback in URL parameters; use a local toast.
- Use the semantic color tokens in `src/app/globals.css` for accent, success, error, warning and
  primary actions instead of hard-coding black action buttons.
- User-facing copy is English, structured so it can be localized later.

## Never `autoFocus` inside a dialog

Inputs and textareas inside a `DialogShell` must **not** use React's `autoFocus` prop. Initial focus
is handled by `openDialog()` via `focusFirstDialogField()`, which focuses the first field after
`showModal()`.

Combining `autoFocus` with `showModal()` and `focusFirstDialogField()` produces an **infinite React
commit loop** (`commitMutationEffectsOnFiber` → `commitHostUpdate` repeating forever, with no
"Maximum update depth" error) that hard-freezes the tab. It only triggers when the tab is focused, so
that `requestAnimationFrame` actually fires the deferred `openDialog` — which is why it can pass a
quick look and still ship. Found while building the Designs feature (#61), whose dialogs were the only
ones setting `autoFocus`. If a dialog freezes the browser on open, look for a stray `autoFocus`.
