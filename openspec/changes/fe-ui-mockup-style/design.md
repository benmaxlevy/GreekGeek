## Context

The web app already has self-hosted Instrument Sans and Playfair Display fonts, shared token aliases, glass utilities, shadcn-style UI primitives, and an authenticated `AppShell`. Existing route components still mix those foundations with legacy utility classes and route-specific presentation. The mockup handoff provides the target token values, glass recipe, portal attributes, button variants, typography utilities, and responsive behavior.

Implementation stays inside `apps/web`. Existing TanStack Router routes, API clients, query keys, auth guards, permission checks, and feature state remain untouched. See proposal.md for motivation and `specs/obsidian-glass-theme/spec.md` for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Establish one canonical mockup-aligned token layer in `apps/web/src/styles.css`.
- Make shared UI primitives the default source for glass surfaces, controls, statuses, typography, and page furniture.
- Make `AppShell` span the viewport at desktop sizes, retain readable content sizing, and keep accessible responsive navigation.
- Apply explicit member and executive portal attributes so ambient treatments remain visually distinct.
- Audit every existing web route and shared component for legacy palette, surface, button, spacing, and typography usage.
- Verify representative route families at desktop and narrow responsive widths without adding visual-regression infrastructure.

**Non-Goals:**

- No API, Prisma, Stripe, authentication, authorization, or data-flow changes.
- No route additions, route removals, URL changes, or feature behavior changes.
- No photography, hero imagery, asset sourcing, or image-driven hero treatment.
- No replacement of the existing router, component library, or styling framework.

## Decisions

### Use `styles.css` as canonical token and recipe source

Port the mockup's CSS custom properties, portal overrides, glass recipe, button states, field states, status badges, sidebar links, and typography utilities into the existing global stylesheet. Preserve compatibility aliases already consumed by the UI primitives so token migration does not require simultaneous route-level rewrites.

Alternative considered: copy mockup classes into individual route files. Rejected because it recreates per-route styling and makes all-route consistency difficult to enforce.

### Keep shared primitive APIs stable; align their variants

Update existing Button, Card, and related UI primitives to map current component variants to mockup-aligned classes and tokens. Add only missing shared variants or small presentation primitives required by the spec. Route components continue using existing props and behavior.

Alternative considered: replace primitives with mockup component copies. Rejected because it would create duplicate APIs and expand the visual change into an unnecessary component migration.

### Put portal identity at shell boundaries

Set `data-portal="member"` or `data-portal="exec"` on the shell roots that own each route family. Global portal selectors then provide ambient background, radius, glass-border, and executive rail differences without route-specific color objects. Public/auth routes use the shared base theme and do not receive a misleading portal identity.

Alternative considered: infer portal styling separately in each page. Rejected because route-level inference drifts and cannot guarantee consistent chrome across all existing routes.

### Make member layout full-width while retaining readable content sizing

Remove fixed 480px member shell constraints. The shell and primary surfaces use available viewport width; individual text-heavy or dense content regions may retain token-backed max widths for readability. Executive desktop navigation continues using the shared sidebar width token and content sizing.

Alternative considered: preserve the phone frame and scale it up at larger breakpoints. Rejected because it keeps mobile-first constraints visible on desktop and violates the locked full-width requirement.

### Use route-family audit plus focused smoke coverage

Audit route files and shared components by route family: public/auth, member app, executive/org, admin, ticketing, payments, and pending/utility states. Replace visual-only legacy classes with shared tokens and primitives, then add or extend lightweight Playwright checks for representative routes and responsive shell assertions.

Alternative considered: add CSS snapshots or a visual-regression suite. Rejected because the capability explicitly requires lean smoke coverage and visual snapshots would add maintenance unrelated to this UI-only alignment.

### Keep imagery absent

Do not add photography or hero-image dependencies. Glass sheen, ambient gradients, watermark treatment, spacing, and typography must establish hierarchy on their own until a later asset decision.

## Risks / Trade-offs

- [Risk] Global token changes can alter routes that depend on legacy aliases → preserve aliases during migration and verify route families after each shared-style update.
- [Risk] Removing the 480px member frame can expose cramped or overly wide route-level layouts → audit grid/container classes and use shared responsive content sizing, not a replacement fixed shell.
- [Risk] Portal attributes may be assigned inconsistently → centralize assignment at shell boundaries and assert attributes in smoke coverage.
- [Risk] Glass effects vary across browsers or reduced-motion settings → retain solid token-backed fallbacks, visible borders, focus rings, and the existing reduced-motion behavior.
- [Risk] Broad visual edits can accidentally alter interaction affordances → limit route changes to presentation classes/props and run existing typecheck, lint, and e2e checks.
- [Trade-off] Without photography, some mockup hero compositions will be flatter → intentionally rely on ambient treatment and glass layering; defer imagery rather than invent assets.

## Migration Plan

1. Port and reconcile global tokens, font mappings, portal ambient rules, glass recipe, and typography utilities.
2. Align shared primitives and shell chrome, including full-width member layout and responsive navigation.
3. Audit all existing route and shared component presentation, preserving URLs, feature states, and data access.
4. Run lint, typecheck, existing e2e, and focused route-matrix smoke checks at desktop and narrow widths.
5. Roll back by reverting only the frontend style, shell, primitive, route presentation, and test changes; backend state requires no migration or rollback.
