<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="JotPoc icon">
</p>

# JotPoc

JotPoc is a cross-platform companion in the Twist family, built around quick capture and easy access to personal information. Its name draws on **Jot + Pocket**, a place to keep ideas as they arrive.

Version **1.0.1** connects the native shell to the existing TwistBalance services and reuses the main site's memo editor, translation workspace, and collections components. It is under integration verification. The frontend production build passes; the updated native integration and authenticated end-to-end flows still require validation.

## Current features

- Connect through TwistBalance device authorization, inspect and revoke sessions, and store access credentials through the native secure-keystore plugin.
- Edit daily memos with the main site's Tiptap editor, custom task lists, source blocks, linked source-note cards, formatting toolbar, undo/redo, and preview mode.
- Select dates and browse recent memo history using the existing calendar and field components.
- Preserve account-specific memo drafts locally, autosave permitted edits, retry exact operations after lost acknowledgements, and resolve cloud conflicts explicitly.
- Browse, create, edit, classify, and delete URL-based notes, retaining local drafts when saving fails.
- Translate with the existing model selection, streaming responses, dictionary lookup, analysis, comparison, local version history, and cloud collections.
- Use speech playback when the system WebView provides compatible speech-synthesis voices.
- Browse and manage web collections captured through Twill, including edits, deletions, and linked notes.
- Keep translation and editing views mounted across desktop window-mode transitions.
- Switch between a full desktop window and a compact panel.
- Collapse the window into a draggable floating entry and expand it again.
- Control always-on-top behavior for full and compact windows.
- Preserve separate window geometry for the full window, compact panel, and floating entry during the application session.
- Restore the previous window configuration when a mode transition fails.
- Open TwistBalance in the system browser.
- Use Simplified Chinese and English UI message catalogs, with Simplified Chinese as the default.
- Use a feather-and-document application icon derived from the Twist visual identity.

## Platforms

The project targets macOS, Windows, Linux, iOS, and Android through Tauri 2.

The 1.0.0 macOS shell debug build was verified. The 1.0.1 frontend passes type checking and production bundling. Native HTTP and secure-keystore dependencies must be resolved and the updated native build verified before release. Windows and Linux also require platform testing.

The mobile entry point is configured. iOS and Android platform projects, signing, device testing, and system quick-access integrations remain pending. Desktop mini windows and pinning are exposed only on desktop platforms. Cross-application mobile overlays are not implemented.

## Service integration and boundaries

The client uses Bearer authorization against `https://twist-balance.pages.dev/api/extension/`. Requests omit website cookies. Local drafts, settings, translation versions, and translation caches are partitioned by account. Access tokens are stored separately through the secure-keystore plugin.

Deploy the accompanying TwistBalance changes before testing this version. The server must accept `JotPoc` alongside `Twill` during device authorization and expose the scoped `daily-memos/detail` and `source-notes/detail` reads. No database migration is required for those routes.

Memo editing remains subject to the separate device permission configured in TwistBalance. Background checkpoint polling refreshes memo and note data; local conflicts require an explicit choice before overwriting either version.

Webpage identification, selection capture, and page annotations continue through Twill. JotPoc accepts explicit URL-based note input and manages existing web collections. Clicking an HTTP or HTTPS source link in a collection or dictionary entry opens the page in the system browser.

Offline storage preserves local drafts and translation history. Network-backed generation, cloud reads, collection changes, and authorization require connectivity. This version does not implement a general offline queue for every operation.

## Technology

- Tauri 2 and Rust
- React 19 and TypeScript
- Vite 8
- pnpm 10.5.2

## Requirements

- Node.js 20.19 or later in the 20.x line, or Node.js 22.12 or later
- pnpm 10.5.2
- A current stable Rust toolchain with Cargo
- The system build dependencies for the target platform

Follow the official platform setup instructions before building. macOS desktop development requires Xcode Command Line Tools. iOS and Android development require their respective native toolchains. [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Development

Install the JavaScript dependencies from the repository root.

```bash
pnpm install
```

Resolve the native dependencies after installing or updating the Rust manifest.

```bash
cargo fetch --manifest-path src-tauri/Cargo.toml
```

Check the TypeScript source.

```bash
pnpm check
```

Start the native desktop application.

```bash
pnpm tauri dev
```

Tauri starts the Vite development server and the Rust application together. The Vite server uses port 1420. The first native build downloads and compiles the Rust dependencies.

Build the frontend.

```bash
pnpm build
```

Build and package the desktop application for the current host platform.

```bash
pnpm tauri build
```

The frontend output is written to `dist/`. Native build and bundle output is written under `src-tauri/target/`.

## Project structure

```text
assets/branding/exploration/  Application icon source candidates
src/data/                   Account-specific storage and service contracts
src/features/auth/          Device authorization and session coordination
src/features/daily-memos/   Main-site editor and durable memo save controller
src/features/source-notes/ URL-based note listing and editing
src/features/translation/  Translation, analysis, versions, and collections
src/features/collections/  Web collection viewing and management
src/features/shell/        Workspace tabs, desktop controls, and floating entry
src/i18n/                   UI message lookup and language catalogs
src/platform/               Native HTTP, credentials, navigation, and window access
src/styles/                 Application styling and shared Twist tokens
src-tauri/capabilities/      Native permission configuration
src-tauri/icons/             Desktop and mobile application icons
src-tauri/src/               Native entry point and window controller
```

## Language conventions

Repository documentation and source comments use English. User-facing text uses the Simplified Chinese and English catalogs through `getText`. Missing messages display their key path.

## Icons

The current application icon uses the feather with a document badge. Its source is `assets/branding/exploration/01-feather-note-badge.png`.

Regenerate the platform icon files with the installed Tauri CLI.

```bash
pnpm exec tauri icon assets/branding/exploration/01-feather-note-badge.png --output src-tauri/icons
```

The desktop icon paths are configured in `src-tauri/tauri.conf.json`.

## Versioning

The initial shell version is **1.0.0**. The current integration version is **1.0.5**. Subsequent versions increment the final number. Keep the application version aligned across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Cargo updates the workspace package entry in `src-tauri/Cargo.lock` when the Rust package version changes.

Record changes in [CHANGELOG.md](CHANGELOG.md).
