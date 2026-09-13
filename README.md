# Cursor RTL Chat Fix

Cursor's built-in AI chat panel is part of its core app UI, not a
standard VS Code extension surface, so a normal marketplace extension
can't reach it. This is a small local patch instead: it injects a
script into Cursor's own `workbench.html` that watches the chat panel
and automatically sets right-to-left direction on any paragraph that
contains Arabic/Persian (or other RTL) text, while leaving code blocks
and the editor untouched. It also fixes the chat input box so it flips
to RTL while you type Arabic/Persian.

## Install

1. Quit Cursor completely.
2. From a terminal, in the folder with these two files, run:
   ```
   node patch-cursor-rtl.js
   ```
   It auto-detects Cursor's install location on macOS/Windows/Linux.
   If it can't find it, open Cursor → Help → Toggle Developer Tools →
   Sources tab, search for `workbench.html` to get the exact path, then run:
   ```
   node patch-cursor-rtl.js --path "/full/path/to/workbench.html"
   ```
3. Reopen Cursor. Arabic/Persian text in the chat panel should now
   render right-to-left automatically, paragraph by paragraph.

## Revert

```
node patch-cursor-rtl.js --revert
```

## Notes / caveats

- This edits Cursor's own application files on your machine — it's
  not something installable from the Marketplace, and it isn't
  malicious, but Cursor may show an "installation appears modified"
  notice afterward. That's expected and safe to dismiss.
- Every Cursor update overwrites `workbench.html`, so you'll need to
  re-run the patch after updating.
- If some part of the chat still doesn't flip correctly (e.g. Cursor
  changes its internal DOM structure in a future version), open dev
  tools on the chat panel, inspect the element in question, and let
  me know the class name — the detection in `rtl-injector.js` is
  written generically (it just looks for RTL Unicode characters in
  any text-bearing element), but it can be tightened to also target
  specific chat containers if the generic pass misses something.
