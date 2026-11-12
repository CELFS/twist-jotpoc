# Changelog

## 1.0.1 - Unreleased

### Added

- Added JotPoc device authorization, session restoration, cancellation, revocation, and native credential storage.
- Added native authenticated HTTP with account-change cancellation and credential-expiration handling.
- Reused the TwistBalance memo editor, custom extensions, calendar, formatting, source blocks, linked notes, and preview behavior.
- Added account-specific memo drafts, autosave, exact-operation retries, permission checks, history, and explicit conflict resolution.
- Added URL-based note history, creation, editing, classification, deletion, and durable drafts.
- Reused translation streaming, model selection, dictionary, analysis, comparison, local history, versions, and cloud collection features.
- Added web collection browsing, editing, deletion, and linked-note navigation.
- Added translation, memo, and note workspace tabs with preserved state across window-mode transitions.
- Added Simplified Chinese and English messages for the connected workspace.
- Added scoped memo and note detail reads in the accompanying TwistBalance service integration.

### Verification status

- Frontend type checking and production bundling pass.
- Memo save regression checks cover concurrent typing, lost acknowledgements, cloud conflicts, refresh races, remote deletion, and account switching.
- Updated native builds, deployed-service authorization, external source opening, and target-platform runtime validation remain release requirements.

## 1.0.0 - 2026-11-12

### Added

- Established the Tauri 2, React, TypeScript, and Vite application foundation.
- Added a native desktop shell with full-window, compact-panel, and collapsed floating-entry modes.
- Added floating-entry dragging and desktop always-on-top controls.
- Added separate in-session geometry for each desktop window mode and restoration after failed transitions.
- Added a system-browser entry to TwistBalance.
- Added Simplified Chinese and English UI message catalogs.
- Added the feather-and-document application icon and platform icon assets.
- Added English setup, build, architecture, and language-convention documentation.

### Fixed

- Supplied the application icon required by Tauri context generation to resolve the native compilation failure.
