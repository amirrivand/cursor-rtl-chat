#!/usr/bin/env node
/**
 * patch-cursor-rtl.js
 * Injects rtl-injector.js into Cursor's workbench.html AND into every
 * generic webview-hosting HTML page under the app (Cursor's chat panel
 * content is likely rendered inside a sandboxed webview iframe rather
 * than the main workbench document, so patching workbench.html alone
 * isn't enough).
 *
 * Usage:
 *   node patch-cursor-rtl.js                  # find + patch everything
 *   node patch-cursor-rtl.js --root "<dir>"   # point at a specific app dir
 *   node patch-cursor-rtl.js --revert         # restore all patched files
 *
 * Quit Cursor completely before/after patching.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKER = '<!-- cursor-rtl-support -->';

function guessAppRoots() {
  const platform = os.platform();
  if (platform === 'darwin') {
    return ['/Applications/Cursor.app/Contents/Resources/app'];
  }
  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    return [path.join(localAppData, 'Programs', 'cursor', 'resources', 'app')];
  }
  return [
    '/usr/share/cursor/resources/app',
    '/opt/Cursor/resources/app',
    path.join(os.homedir(), '.local/share/cursor/resources/app'),
  ];
}

function findAppRoot(customRoot) {
  if (customRoot) return fs.existsSync(customRoot) ? customRoot : null;
  const found = guessAppRoots().find((p) => fs.existsSync(p));
  if (found) return found;
  // Check for the packed (asar) case so we can give a clear error instead of silently finding nothing.
  const asarCandidates = guessAppRoots().map((p) => p + '.asar');
  const asarFound = asarCandidates.find((p) => fs.existsSync(p));
  if (asarFound) {
    console.error('Found ' + asarFound + ' but it is a packed .asar archive, not a plain folder.');
    console.error('This script only edits unpacked files. Unpack it first, e.g.:');
    console.error('  npx --yes asar extract "' + asarFound + '" "' + asarFound.replace(/\.asar$/, '') + '"');
    console.error('then move/rename the original .asar out of the way (e.g. add .bak) so Cursor loads the unpacked folder,');
    console.error('and re-run this script with --root pointing at that folder.');
  }
  return null;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
}

function findTargetHtmlFiles(root) {
  const all = [];
  walk(root, all);
  return all.filter((p) => {
    const name = path.basename(p).toLowerCase();
    const lowerPath = p.toLowerCase();
    const isWorkbench = name === 'workbench.html';
    const isWebviewHost =
      lowerPath.includes(path.sep + 'webview' + path.sep) &&
      (name === 'index.html' || name === 'index-no-csp.html' || name.startsWith('index'));
    return isWorkbench || isWebviewHost;
  });
}

function relaxCsp(html) {
  return html.replace(
    /(<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=["'])([^"']*)(["'])/i,
    (full, pre, csp, post) => {
      if (/script-src[^;]*'unsafe-inline'/.test(csp)) return full;
      const newCsp = /script-src/.test(csp)
        ? csp.replace(/script-src([^;]*)/, (m, rest) => `script-src${rest} 'unsafe-inline'`)
        : csp + "; script-src 'self' 'unsafe-inline'";
      return pre + newCsp + post;
    }
  );
}

function patchFile(htmlPath, injectorContent) {
  const backupPath = htmlPath + '.rtl-backup';
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (html.includes(MARKER)) {
    return 'already-patched';
  }
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, html, 'utf8');
  }
  html = relaxCsp(html);
  const inlineScript = `${MARKER}\n<script>\n${injectorContent}\n</script>\n</html>`;
  if (/<\/html>\s*$/i.test(html)) {
    html = html.replace(/<\/html>\s*$/i, inlineScript);
  } else if (/<\/body>\s*<\/html>/i.test(html)) {
    html = html.replace(/<\/body>\s*<\/html>/i, `</body>\n${inlineScript}`);
  } else {
    html += '\n' + inlineScript;
  }
  fs.writeFileSync(htmlPath, html, 'utf8');
  return 'patched';
}

function revertFile(htmlPath) {
  const backupPath = htmlPath + '.rtl-backup';
  if (!fs.existsSync(backupPath)) return 'no-backup';
  fs.copyFileSync(backupPath, htmlPath);
  fs.unlinkSync(backupPath);
  return 'reverted';
}

function main() {
  const args = process.argv.slice(2);
  const revert = args.includes('--revert');
  const rootArgIndex = args.indexOf('--root');
  const customRoot = rootArgIndex !== -1 ? args[rootArgIndex + 1] : null;
  const injectorArgIndex = args.indexOf('--injector');
  const injectorPath = injectorArgIndex !== -1 ? args[injectorArgIndex + 1] : path.join(__dirname, 'rtl-injector.js');

  const root = findAppRoot(customRoot);
  if (!root) {
    console.error('Could not find Cursor\'s app folder automatically.');
    console.error('Re-run with --root "<path to resources/app>". Find it via Cursor > Help > Toggle Developer Tools > Sources tab.');
    process.exit(1);
  }

  const targets = findTargetHtmlFiles(root);
  if (targets.length === 0) {
    console.error('No workbench.html or webview host pages found under ' + root);
    process.exit(1);
  }

  console.log('Found ' + targets.length + ' candidate file(s) under ' + root + ':');
  targets.forEach((t) => console.log('  ' + t));

  if (revert) {
    targets.forEach((t) => console.log('  -> ' + revertFile(t) + ': ' + t));
    console.log('Done. Restart Cursor.');
    return;
  }

  const injectorContent = fs.readFileSync(injectorPath, 'utf8');
  targets.forEach((t) => console.log('  -> ' + patchFile(t, injectorContent) + ': ' + t));

  console.log('');
  console.log('Quit Cursor completely and reopen it for the change to take effect.');
  console.log('If Cursor shows an "installation appears modified" notice, that is expected and safe to dismiss.');
  console.log('Re-run this script after every Cursor update (updates overwrite these files).');
}

main();
