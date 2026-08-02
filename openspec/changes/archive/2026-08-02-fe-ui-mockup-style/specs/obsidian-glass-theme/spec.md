## MODIFIED Requirements

### Requirement: Obsidian-glass tokens and fonts are the sole theme source

The web application MUST apply the rally-mockup-handoff design tokens as CSS custom properties and MUST load the configured display and UI fonts used by the mockup. UI color, typography, spacing, radii, borders, shadows, motion, and responsive values MUST reference those tokens or theme mappings derived from them. The application MUST NOT introduce per-route inline color palette objects as the source of truth for visual styling.

#### Scenario: Token-backed surfaces render on every themed page

- **WHEN** a user opens any existing web route
- **THEN** page background, text, borders, controls, and surfaces resolve through the shared token system rather than route-specific palettes

#### Scenario: Brand typography applies consistently

- **WHEN** a themed page renders display headings, labels, body text, or numeric values
- **THEN** each text role uses the shared typography tokens or utilities defined by the mockup-aligned theme

### Requirement: Ambient body treatment and layout tokens

The application MUST apply shared ambient page treatment through portal context and MUST expose layout tokens for sidebar width, content sizing, navigation height, spacing, and responsive breakpoints. Member portal ambient treatment MUST be warmer and executive portal ambient treatment MUST be cooler with a persistent top rail. The primary web shell MUST be full-width and desktop-first; it MUST NOT constrain member routes to a fixed 480px phone column.

#### Scenario: Member portal ambient treatment renders

- **WHEN** a user opens a member route
- **THEN** the page uses the warmer member ambient treatment while remaining full-width at desktop viewport sizes

#### Scenario: Executive portal ambient treatment renders

- **WHEN** a user opens an executive route
- **THEN** the page uses the cooler executive ambient treatment and displays its persistent top rail

#### Scenario: Responsive shell preserves available width

- **WHEN** a user resizes an existing route from desktop through narrow responsive widths
- **THEN** layout reflows navigation, grids, and content without applying a fixed 480px primary shell width

### Requirement: Shared UI primitives with glass variants

The web application MUST provide shared visual primitives for buttons, glass cards, inputs, labels, forms, separators, badges, avatars, dropdown menus, toast notifications, skeletons, gates, page furniture, and status treatments. Glass panel styling MUST use the shared glass recipe, including translucent surface, blur, border, sheen, and shadow behavior. Primary actions MUST use white fill with black text, matching the mockup's `rl-btn-primary` treatment.

#### Scenario: Shared glass surface renders

- **WHEN** a route renders a card, panel, modal, or grouped surface
- **THEN** it uses the shared glass treatment or a documented token-backed surface variant rather than a route-specific approximation

#### Scenario: Primary action renders in mockup style

- **WHEN** a route renders its primary action
- **THEN** the action has a white background, black text, shared button dimensions, focus state, hover state, and disabled state

#### Scenario: Status treatment remains accessible

- **WHEN** a route renders a status, alert, pending state, or error
- **THEN** the shared status treatment pairs visual color with text or an icon and preserves visible focus and readable contrast

### Requirement: App shell and brand lockup

Authenticated product chrome MUST present a shared full-width responsive shell across all existing web routes. Executive routes MUST provide a desktop sidebar using the shared sidebar width token and a content area using shared content sizing. Member routes MUST use desktop-capable content width rather than a fixed phone column. Below the responsive navigation breakpoint, navigation MUST remain available through an accessible mobile control. Brand identity MUST be available through shared Wordmark and BrandLockup presentation.

#### Scenario: Desktop member shell layout

- **WHEN** a signed-in user views a member route at a desktop viewport
- **THEN** the member shell spans the available viewport width, presents aligned page chrome, and does not render as a centered 480px phone frame

#### Scenario: Desktop executive shell layout

- **WHEN** a signed-in user views an executive route at or above the desktop breakpoint
- **THEN** a shared sidebar is visible, the main content uses shared layout tokens, and the executive top rail identifies the portal

#### Scenario: Responsive navigation remains available

- **WHEN** a signed-in user views any authenticated route below the responsive navigation breakpoint
- **THEN** navigation is available through an accessible drawer, compact navigation, or equivalent responsive control without losing route access

#### Scenario: Brand lockup renders in shell or auth chrome

- **WHEN** the shell or auth screens render brand identity
- **THEN** the shared Wordmark or BrandLockup presentation appears using the aligned typography and surface tokens

### Requirement: Theme smoke coverage without visual regression suites

Theme verification MUST cover representative existing member, executive, auth/onboarding, ticketing, money, chapter, scanner, admin, agency, and production routes at desktop and responsive widths. Verification MUST confirm shared portal attributes, token-backed surfaces, full-width shell behavior, white primary actions, and responsive navigation. The project MUST NOT require CSS snapshot or visual-regression suites for this capability.

#### Scenario: Representative route matrix is exercised

- **WHEN** the frontend theme verification runs
- **THEN** representative routes from each existing route family render with the aligned shell and no CSS snapshot or visual-regression suite is required

#### Scenario: Responsive shell behavior is checked

- **WHEN** theme verification runs at desktop and narrow responsive widths
- **THEN** member routes remain full-width, executive navigation remains usable, and portal ambient treatments stay distinguishable

## ADDED Requirements

### Requirement: Existing web routes use one visual system

Every existing web route and shared web component MUST use the aligned theme, shell chrome, typography utilities, glass recipe, and shared control treatments. Restyling MUST preserve existing route URLs, feature affordances, navigation destinations, and visible data states. This requirement covers presentation only and MUST NOT introduce API, Prisma, Stripe, authentication, permission, or data-flow changes.

#### Scenario: Existing route preserves feature surface

- **WHEN** a user visits an existing route after visual alignment
- **THEN** the route remains reachable with its existing feature affordances and data states while rendering aligned visual chrome

#### Scenario: Backend boundaries remain unchanged

- **WHEN** the frontend style alignment is implemented
- **THEN** no API, Prisma, Stripe, authentication, permission, or backend data contract changes are required
