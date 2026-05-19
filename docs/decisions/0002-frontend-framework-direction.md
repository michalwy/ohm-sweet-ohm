# ADR 0002: Frontend Framework Direction

## Status

Accepted.

## Context

OhmSweetOhm is expected to grow beyond the initial parts list into a more dynamic workshop management application. Future UI work may include interactive tables, dialogs, forms, filters, and richer workflows.

The initial skeleton uses Next.js App Router, which means the application is already built on React. Angular and Vue were considered as alternatives before the application had accumulated significant feature code.

## Decision

Continue with Next.js App Router, React, and TypeScript as the frontend direction.

Use client components where browser-side interactivity is needed, while keeping server-side data access and domain behavior out of UI components as the application grows.

When richer UI primitives are needed, prefer boring, well-supported React ecosystem libraries instead of changing framework direction. Examples include dedicated libraries for tables, dialogs, forms, validation, and accessible headless components.

## Rationale

Next.js keeps the project as one deployable web app while still supporting dynamic React UI. This fits the current product stage better than splitting a separate API and single-page application early.

React has mature options for advanced tables, dialogs, and interactive controls. The expected UI complexity is not a reason by itself to move away from Next.js.

Angular would provide a more opinionated enterprise structure, but it would add more framework weight before the product needs it. Vue would be a reasonable alternative, especially with Nuxt, but it does not currently offer enough advantage to justify migration from the existing stack.

## Consequences

- Future frontend work should use Next.js App Router conventions.
- Interactive features should be added as focused client components, not by converting the whole app to client-side rendering by default.
- Complex UI behavior should be handled with established React libraries when the need becomes concrete.
- A future migration to Angular, Vue, or another framework should require a specific product or technical problem that Next.js and React cannot reasonably solve.
