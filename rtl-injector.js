// cursor-rtl-support: auto-detects Arabic/Persian (and other RTL) text
// inside Cursor's UI (chat panel, input box, etc.) and sets direction
// per-element so it renders correctly, without touching code/editor content.
(function () {
  if (window.__cursorRtlSupportInstalled) return;
  window.__cursorRtlSupportInstalled = true;

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

  // Initial pass
  applyToElement(document.body);
  scanInputs(document.body);

  // Keep up with streamed/new chat content
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) {
          applyToElement(n);
          scanInputs(n);
        } else if (n.nodeType === 3 && n.parentElement) {
          applyToElement(n.parentElement);
        }
      });
      if (m.type === 'characterData' && m.target.parentElement) {
        applyToElement(m.target.parentElement);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
