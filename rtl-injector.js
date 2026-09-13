// cursor-rtl-support: auto-detects Arabic/Persian (and other RTL) text
// and sets per-element direction so it renders correctly. Installs into
// the current document, and also tries to reach into same-origin nested
// iframes (VS Code/Cursor webviews sometimes host content in a nested
// same-origin iframe under the webview bootstrap page).
(function () {
  if (window.__cursorRtlSupportBootstrapped) return;
  window.__cursorRtlSupportBootstrapped = true;

  const RTL_RE = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  const LTR_RE = /[A-Za-z\u00C0-\u024F]/;

  function getTextDirection(text) {
    if (!text) return null;
    for (const ch of text) {
      if (RTL_RE.test(ch)) return 'rtl';
      if (LTR_RE.test(ch)) return 'ltr';
    }
    return null;
  }

  function isCodeContext(el) {
    return !!el.closest('.monaco-editor, pre, code, .cm-editor, .view-lines');
  }

  function install(doc) {
    if (!doc || doc.__cursorRtlSupportInstalled) return;
    try {
      doc.__cursorRtlSupportInstalled = true;
    } catch (e) {
      return; // cross-origin, can't touch it
    }

    function applyToElement(el) {
      if (!el || el.nodeType !== 1 || isCodeContext(el)) return;
      const hasDirectText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1
      );
      if (hasDirectText) {
        el.style.unicodeBidi = 'plaintext';
        el.style.textAlign = 'start';
        const dir = getTextDirection(el.textContent || '');
        if (dir) el.setAttribute('dir', dir);
      }
      for (const child of el.children) applyToElement(child);
    }

    function bindInputBox(el) {
      if (el.dataset.rtlInputBound) return;
      el.dataset.rtlInputBound = '1';
      const update = () => {
        const text = el.value !== undefined ? el.value : el.textContent;
        const dir = getTextDirection(text || '');
        el.setAttribute('dir', dir || 'auto');
        el.style.textAlign = dir === 'rtl' ? 'right' : '';
      };
      el.addEventListener('input', update);
      update();
    }

    function scanInputs(root) {
      root.querySelectorAll('textarea, [contenteditable="true"]').forEach(bindInputBox);
    }

    function tryHookIframe(iframe) {
      try {
        const inner = iframe.contentDocument;
        if (inner) {
          if (inner.readyState === 'complete' || inner.readyState === 'interactive') {
            install(inner);
          }
          iframe.addEventListener('load', () => install(iframe.contentDocument));
        }
      } catch (e) {
        // cross-origin iframe; can't reach it from here
      }
    }

    function scanIframes(root) {
      root.querySelectorAll('iframe').forEach(tryHookIframe);
    }

    if (doc.body) {
      applyToElement(doc.body);
      scanInputs(doc.body);
      scanIframes(doc.body);
    }

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) {
            applyToElement(n);
            scanInputs(n);
            scanIframes(n);
            if (n.tagName === 'IFRAME') tryHookIframe(n);
          } else if (n.nodeType === 3 && n.parentElement) {
            applyToElement(n.parentElement);
          }
        });
        if (m.type === 'characterData' && m.target.parentElement) {
          applyToElement(m.target.parentElement);
        }
      }
    });
    observer.observe(doc.documentElement || doc, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  install(document);
})();
