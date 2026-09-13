# Cursor RTL Chat Fix

Cursor's built-in AI chat panel isn't a normal VS Code extension surface,
so a marketplace extension can't reach it directly. This is a small local
patch: it injects a script into Cursor's own HTML files that detects
Arabic/Persian (or other RTL) text and sets direction per paragraph,
without touching code blocks or the editor.

The chat panel's message content most likely renders inside a sandboxed
webview (a nested iframe), not the main window document — so this version
patches **both** `workbench.html` and any generic webview-hosting pages
found under Cursor's app folder, and the injected script also tries to
reach into same-origin nested iframes inside those.

## Install

1. Quit Cursor completely.
2. In a terminal, in the folder with these files, run:
   ```
   node patch-cursor-rtl.js
   ```
   It auto-detects Cursor's install location on macOS/Windows/Linux and
   patches every matching HTML file it finds (you'll see a list printed).

   If it reports Cursor's app is packed as `app.asar` (a single archive
   file, not a folder), it will print unpack instructions — this script
   only edits plain files, not asar archives.

   If it can't find the app folder at all, open Cursor → Help → Toggle
   Developer Tools → Sources tab to find the real path, then run:
   ```
   node patch-cursor-rtl.js --root "/full/path/to/resources/app"
   ```
3. Reopen Cursor and test with some Arabic/Persian text in the chat.

## Revert

```
node patch-cursor-rtl.js --revert
```

## If it still doesn't work

This means the chat content lives somewhere this script's heuristics
didn't find (Cursor's internals aren't public, so this is a best-effort
pattern match, not a guarantee). To pin it down exactly:

1. Right-click inside the chat panel → Inspect Element.
2. If that opens a devtools window whose top document URL is something
   like `vscode-webview://...` (different from the main window), the
   chat is indeed in its own webview — note that URL.
3. In that devtools' Sources/Application tab, find the actual HTML file
   or inline `<script>` that sets up that page, and tell me its path or
   content — the injector can be targeted at it directly instead of
   relying on the generic search.

## Notes

- This edits Cursor's own app files locally — not publishable to a
  marketplace, not malicious, but Cursor may show a "modified
  installation" notice after patching. Safe to dismiss.
- Re-run after every Cursor update (updates overwrite these files).
