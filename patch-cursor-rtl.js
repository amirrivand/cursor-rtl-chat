#!/usr/bin/env node
/**
 * patch-cursor-rtl.js
 * Injects rtl-injector.js into Cursor's workbench.html so Arabic/Persian
 * text renders correctly (auto RTL/LTR per paragraph) in the chat panel.
 *
 * Usage:
 *   node patch-cursor-rtl.js                 # find + patch automatically
 *   node patch-cursor-rtl.js --path "<file>"  # patch a specific workbench.html
 *   node patch-cursor-rtl.js --revert         # restore the original file
 *
 * Quit Cursor completely (not just reload window) before/after patching.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKER = '<!-- cursor-rtl-support -->';

function guessWorkbenchHtmlPaths() {
  const platform = os.platform();
  const rel = 'out/vs/code/electron-sandbox/workbench/workbench.html';
  if (platform === 'darwin') {
    return ['/Applications/Cursor.app/Contents/Resources/app/' + rel];
  }
  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    return [path.join(localAppData, 'Programs', 'cursor', 'resources', 'app', rel)];
  }
  return [
    '/usr/share/cursor/resources/app/' + rel,
    '/opt/Cursor/resources/app/' + rel,
    path.join(os.homedir(), '.local/share/cursor/resources/app', rel),
  ];
}

function findWorkbenchHtml(customPath) {
  if (customPath) return fs.existsSync(customPath) ? customPath : null;
  return guessWorkbenchHtmlPaths().find((p) => fs.existsSync(p)) || null;
}

function relaxCsp(html) {
  return html.replace(
    /(<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=["'])([^"']*)(["'])/i,
    (full, pre, csp, post) => {
      if (/script-src[^;]*file:/.test(csp)) return full;
      const newCsp = /script-src/.test(csp)
        ? csp.replace(/script-src([^;]*)/, (m, rest) => `script-src${rest} file: 'unsafe-inline'`)
        : csp + "; script-src 'self' file: 'unsafe-inline'";
      return pre + newCsp + post;
    }
  );
}

function main() {
  const args = process.argv.slice(2);
  const revert = args.includes('--revert');
  const pathArgIndex = args.indexOf('--path');
  const customPath = pathArgIndex !== -1 ? args[pathArgIndex + 1] : null;
  const injectorArgIndex = args.indexOf('--injector');
  const injectorPath = injectorArgIndex !== -1 ? args[injectorArgIndex + 1] : path.join(__dirname, 'rtl-injector.js');

  const htmlPath = findWorkbenchHtml(customPath);
  if (!htmlPath) {
    console.error('Could not find workbench.html automatically.');
    console.error('Open Cursor > Help > Toggle Developer Tools > Sources tab, search "workbench.html" to find the exact path,');
    console.error('then re-run: node patch-cursor-rtl.js --path "<that path>"');
    process.exit(1);
  }

  const backupPath = htmlPath + '.rtl-backup';

  if (revert) {
    if (!fs.existsSync(backupPath)) {
      console.error('No backup found at ' + backupPath + ' — nothing to revert.');
      process.exit(1);
    }
    fs.copyFileSync(backupPath, htmlPath);
    console.log('Reverted: ' + htmlPath);
    return;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  if (html.includes(MARKER)) {
    console.log('Already patched: ' + htmlPath);
    console.log('Run with --revert first if you want to re-apply after editing the injector.');
    return;
  }

  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, html, 'utf8');
    console.log('Backed up original to ' + backupPath);
  }

  html = relaxCsp(html);

  const injectorAbs = path.resolve(injectorPath);
  const scriptTag = `${MARKER}\n<script src="file://${injectorAbs}"></script>\n</html>`;
  html = html.replace(/<\/html>\s*$/i, scriptTag);

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Patched: ' + htmlPath);
  console.log('Quit Cursor completely and reopen it for the change to take effect.');
  console.log('Cursor may show a "installation appears corrupt" style notice after this — that is expected when editing app files locally and is safe to dismiss.');
  console.log('You will need to re-run this script after every Cursor update (updates overwrite this file).');
}

main();
