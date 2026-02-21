# OpenClaw Mobile Style Guide

Scope: `apps/react-native` screens.  
Goal: cohesive, high-clarity UI without card-heavy layouts.

## 1. Design Direction

- Utility first: every screen has one obvious primary action.
- Calm surface: soft neutral background, strong text contrast, restrained accents.
- Minimal chrome: prefer dividers/rails over stacked cards.
- Progressive disclosure: advanced controls hidden until explicitly opened.
- Deterministic flow: validate early, block invalid progression, avoid hidden state.

## 2. Source Of Truth

Base tokens/components live here:

- `src/app/theme.ts`
- `src/features/shared/ui.tsx`
- `src/features/onboarding/onboarding-flow.tsx`
- `src/features/connect/connect-screen.tsx`

If design changes, update tokens first, then screens.

## 3. Tokens

Use token constants; do not hardcode ad-hoc colors/sizes in new screens.

### Color

- Background: `colors.background`, optional `gradients.background`
- Primary accent: `colors.accent` + `colors.accentEnd`
- Text hierarchy: `colors.text`, `colors.textSecondary`, `colors.textTertiary`
- Borders: `colors.border`, `colors.borderStrong`
- Semantic states: `colors.success|warning|danger` + soft variants
- Code blocks: `colors.codeBg`, `colors.codeText`, `colors.codeGreen`

### Typography

- Display/hero: `typography.display`, `typography.title1`
- Section titles: `typography.title2` / `typography.headline`
- Body copy: `typography.body` / `typography.callout`
- Metadata labels: `typography.caption1` / `typography.caption2`
- Technical strings: `typography.mono`

### Radius + Shadow

- Action/button: `radii.button`
- Input: `radii.input`
- Major sections only (if needed): `radii.card`
- Elevation only where interaction matters: `shadows.sm|md` (sparingly)

## 4. Layout System

- Screen base:
  - `SafeAreaView` + soft background gradient
  - `paddingHorizontal: 20`
  - vertical rhythm using `gap` 8/12/16/20
- Structure:
  - Hero intro (kicker, title, short context)
  - Core controls
  - Optional advanced area
  - Sticky bottom action row for flow screens
- Prefer separators:
  - `StyleSheet.hairlineWidth` dividers/rails
  - avoid wrapping every block in card containers

## 5. Component Rules

### Primary action

- Use a single dominant button style (same language as onboarding `Next`).
- Filled accent background, white label, subtle pressed opacity/scale.
- One primary per viewport section.

### Secondary action

- Use outline/quiet pressables.
- Keep visual weight clearly below primary.
- Icon-only secondary action allowed in bottom nav row (example: back arrow).

### Tabs / segmented controls

- Reuse one tab pattern per context.
- For onboarding top step tabs: rail + label pattern.
- For local mode switch (Setup/Manual): compact segmented buttons matching primary style language (not decorative gradients).

### Inputs

- Always paired with uppercase label (`Label` component).
- Inputs use `Input` component from shared UI.
- Keep host+port fields side by side only when both are short.

### Code and command guidance

- Use `CodeBlock` for terminal commands.
- Keep guide text concise; command first, explanation second.
- Avoid long prose under command blocks.

### Advanced controls

- Hidden behind explicit toggle.
- Keep collapsed summary one line.
- Use simple grouped rows with dividers, not nested cards.

## 6. Screen Patterns

### Onboarding flow

- Multi-step rail at top.
- Step content in plain sections (`StepShell`), divider-driven.
- Bottom action bar always visible.
- Validation gating:
  - cannot continue from Gateway step until setup/manual config is valid.
- Auto behaviors:
  - setup code paste should auto-apply when valid.
  - avoid redundant confirm buttons for simple deterministic actions.

### Connect screen

- Hero explains intent + endpoint context.
- State rail surfaces current gateway status once.
- Single top-level connect/disconnect action.
- Pairing recovery commands shown only when pairing is required.
- Advanced block contains setup/manual/TLS/auth plus "Run onboarding again".

## 7. Copy Style

- Short, operational, direct.
- Prefer noun + verb over marketing phrasing.
- One sentence per helper line where possible.
- Avoid duplicate status messaging in multiple places.
- Remove filler subtitles if they do not add action context.

## 8. Interaction + Motion

- Press feedback: opacity change + tiny scale on important actions.
- Motion purpose only:
  - communicate press/selection/state transitions
  - not decorative animation loops
- Keep transitions fast and unobtrusive.

## 9. Accessibility + Usability

- Maintain clear contrast for tab labels and secondary text.
- Touch targets >= 44px height where practical.
- Do not rely on color alone; include text labels for state.
- Keep critical actions near thumb zone on mobile (bottom row).

## 10. Anti-Patterns (Do Not Add)

- Gradient-heavy buttons as default CTA styling.
- Repeated status pills in header + body for same state.
- Card-inside-card nesting for basic layout.
- Duplicate buttons for actions that can be safely auto-applied.
- Unbounded helper text blocks under every control.

## 11. New Screen Checklist

Use this before opening a PR for a new/updated screen.

1. Uses `theme.ts` tokens only (no random hex/font values).
2. Has one clear primary action.
3. Uses divider-led layout; cards only when hierarchy requires it.
4. No duplicate status copy.
5. Advanced settings are collapsed by default.
6. Labels, helper text, and validation copy are concise.
7. Bottom action bar spacing respects safe-area insets.
8. Press states exist for interactive controls.
9. `pnpm tsgo` passes.
10. Visual check on Android emulator + one other target if available.
