# Changelog

## 1.0.12 - Unreleased

- Slide the sidebar in from the right and open settings or account directly from its footer.

## 1.0.11 - Unreleased

- Group memo and note histories by date, browse web collections by source, and show local and collected translations in the translation sidebar.

## 1.0.10 - Unreleased

- Browse memo, note, and translation history in a responsive workspace sidebar.
- Access settings and account management from the sidebar.

## 1.0.9 - Unreleased

- Use compact workspace tabs joined to the content panel in the main and mini windows.
- Retry reading saved credentials when the system credential store is unavailable, and show when account authorization must be renewed.

## 1.0.8 - Unreleased

- Follow the system appearance by default or choose a light or dark theme for the main window, mini panel, floating toolbar, and docked handle.
- Restore the minus icon for collapsing the window and align the floating toolbar on first open on macOS.

## 1.0.7 - Unreleased

- Added an in-window settings page accessible from the header and floating toolbar.
- Added workspace and pin controls to the floating toolbar. It stays within the display, can hide at screen edges, and reappears on hover.
- Updated the window and toolbar styling and clarified the controls for switching to the mini panel or collapsing to the toolbar.
- Kept the macOS title bar integrated when switching window modes.

## 1.0.6 - Unreleased

- Added a header settings button for language selection before and after connecting.

- Keep the collapsed entry at its fixed size and move it directly on macOS to avoid edge tiling.

- Rounded the floating entry and added a gradient border. Expanding restores the previous desktop window mode and size, including the integrated macOS title bar.

## 1.0.5 - Unreleased

- Aligned the account connection card with Twill and added the TwistBalance icon as a direct link to the main site.

## 1.0.4 - Unreleased

- Reduced the initial desktop window to 520 × 380 and aligned the macOS title bar controls with the application toolbar.
- Distinguished the toolbar and workspace with background colors, centered the connection controls, and disabled text selection on buttons.

## 1.0.3 - Unreleased

- Integrated macOS window controls into the application header.
- Added terminal diagnostics for failed account connections and session restoration.

## 1.0.2 - Unreleased

- Enabled system-browser opening for HTTP and HTTPS source links in collections and dictionary entries.

## 1.0.1 - 2026-11-12

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
