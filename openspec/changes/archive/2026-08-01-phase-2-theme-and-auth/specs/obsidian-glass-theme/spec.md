## Purpose

Provides the GreekGeek web app with the obsidian-glass visual system — tokens, fonts, primitives, shell, and brand — so authenticated product screens share one maintainable look without per-route color palettes.

## ADDED Requirements

### Requirement: Obsidian-glass tokens and fonts are the sole theme source

The web application MUST apply the obsidian-glass design tokens as CSS custom properties and MUST load self-hosted Playfair Display and Instrument Sans fonts. UI color and typography MUST reference those tokens (or theme mappings derived from them). The application MUST NOT introduce per-route inline color palette objects as the source of truth for colors.

#### Scenario: Token-backed surfaces render on themed pages

- **WHEN** a user opens a themed page such as login or the authenticated shell
- **THEN** the page background and surfaces resolve through CSS custom properties consistent with the obsidian-glass palette (true-black background, glass/card surfaces, monochrome ink scale, single error red)

#### Scenario: Brand fonts apply to headings and UI text

- **WHEN** a themed page renders headings and form labels
- **THEN** display headings use Playfair Display and UI text uses Instrument Sans via the theme font tokens

### Requirement: Ambient body treatment and layout tokens

The application MUST apply an ambient page gradient via a theme class on the document body and MUST expose layout tokens for sidebar width (232px), content max width (1160px), and navigation height so shell layout can consume them consistently.

#### Scenario: Body theme class enables ambient gradient

- **WHEN** the web app boots
- **THEN** the document body carries the theme class that applies the ambient gradient treatment

### Requirement: Shared UI primitives with glass variants

The web application MUST provide shared UI primitives for button, card, input, label, form, separator, badge, avatar, dropdown menu, toast notifications, and skeleton. Chrome button styling and glass panel card styling MUST be available as reusable variants rather than one-off inline styles.

#### Scenario: Chrome button and glass card are reusable

- **WHEN** a screen needs a primary chrome CTA or a glass surface panel
- **THEN** it uses the shared Button/Card glass variants rather than duplicating glass CSS inline

### Requirement: App shell and brand lockup

Authenticated product chrome MUST present a sticky sidebar of 232px on desktop, a main content area capped at 1160px with comfortable padding, a mobile drawer navigation below 768px, and interactive targets of at least 44px. Brand identity MUST be available via Wordmark and BrandLockup components.

#### Scenario: Desktop shell layout

- **WHEN** a signed-in user views the app on a viewport at or above 768px
- **THEN** a sticky 232px sidebar is visible and main content is constrained to the content max width

#### Scenario: Mobile drawer navigation

- **WHEN** a signed-in user views the app on a viewport below 768px
- **THEN** navigation is available through a hamburger-triggered drawer instead of a persistent sidebar

#### Scenario: Brand lockup renders in shell or auth chrome

- **WHEN** the shell or auth screens render brand identity
- **THEN** Wordmark/BrandLockup appear as the brand signal

### Requirement: Theme smoke coverage without visual regression suites

Theme verification MUST stay lean: either a single e2e smoke that themed auth/shell pages render with expected theme classes or tokens, or reliance on auth e2e that already visit those pages. The project MUST NOT require CSS snapshot or visual-regression suites for this capability.

#### Scenario: Themed pages are exercised by e2e without CSS snapshots

- **WHEN** the Phase 2 test suite runs
- **THEN** themed pages used by auth or shell flows are covered by Playwright e2e (or an optional single smoke) and no CSS snapshot/visual-regression suite is required
