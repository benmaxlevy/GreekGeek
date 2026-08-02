## 1. Establish mockup-aligned theme foundation

- [x] 1.1 Inventory existing web token aliases, legacy palette classes, and route-level visual overrides against the mockup handoff.
- [x] 1.2 Port and reconcile mockup CSS custom properties, font mappings, spacing/radius/shadow/motion tokens, and compatibility aliases in `apps/web/src/styles.css`.
- [x] 1.3 Add shared glass recipe, sheen, status, field, sidebar, button-state, `num`, eyebrow, display-size, watermark, and reduced-motion utilities without adding photography or hero assets.
- [x] 1.4 Add member warmer ambient treatment, executive cooler ambient treatment, and persistent executive top rail using portal-scoped styles.

## 2. Align shell and portal chrome

- [x] 2.1 Assign member and executive portal attributes at shell boundaries while leaving public and auth routes on shared base theme.
- [x] 2.2 Remove fixed 480px member shell constraints and make member shell, primary surfaces, and navigation full-width at desktop sizes.
- [x] 2.3 Preserve executive sidebar token sizing, readable content sizing, sticky/desktop behavior, and responsive drawer or compact navigation below the breakpoint.
- [x] 2.4 Align shell header, sidebar links, responsive controls, footer chrome, and Wordmark/BrandLockup presentation with shared tokens and accessible focus targets.

## 3. Align shared UI primitives

- [x] 3.1 Update Button variants and sizes so primary actions use white fill/black text while ghost, quiet, danger, hover, focus, active, and disabled states use shared tokens.
- [x] 3.2 Update Card and related surface primitives to use the shared translucent glass, blur, border, sheen, shadow, and optional hover-lift recipe.
- [x] 3.3 Align inputs, labels, forms, separators, dropdown menus, and toast surfaces with shared field, border, focus, and typography utilities.
- [x] 3.4 Align badges, avatars, status treatments, skeletons, gates, and page-furniture primitives so status is never conveyed by color alone.

## 4. Restyle every existing web route

- [x] 4.1 Restyle public, auth, signup, blocked, awaiting-approval, and onboarding route presentation without changing guards, redirects, or form behavior.
- [x] 4.2 Restyle member application, profile, ticket, event, and home route presentation using full-width responsive layouts and shared primitives.
- [x] 4.3 Restyle executive organization, event, chapter, analytics, and approval route presentation using the cooler portal shell and shared content layouts.
- [x] 4.4 Restyle admin, user-management, webhook-inbox, support, compliance, and audit route presentation without changing permission or data behavior.
- [x] 4.5 Restyle ticketing, payment, Stripe Connect, payout, checkout, scanner, and setup-wizard components using shared controls and surfaces without changing API or Stripe flows.
- [x] 4.6 Audit remaining shared components and every route under `apps/web/src/routes` for legacy visual overrides, fixed phone-column constraints, and unaligned typography; remove presentation-only drift.

## 5. Verify visual alignment and boundaries

- [ ] 5.1 Add or extend lightweight Playwright smoke coverage for representative public/auth, member, executive, admin, ticketing, money, scanner, and utility routes.
- [ ] 5.2 Verify desktop and narrow responsive states for full-width member layout, executive sidebar/drawer navigation, portal ambient distinction, white primary actions, focus states, and readable status treatments.
- [x] 5.3 Run web lint, typecheck, and existing e2e checks; confirm route URLs, feature affordances, data states, and backend/API/Prisma/Stripe files remain unchanged.
