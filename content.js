(function initContentScript() {
  "use strict";

  if (globalThis.__RussianStressContentLoaded) return;
  globalThis.__RussianStressContentLoaded = true;

  const BUTTON_ID = "russian-stress-floating-button";
  const TOOLTIP_ID = "russian-stress-tooltip";
  const CYRILLIC_RE = /[\u0400-\u04FF]/;
  const WORD_CHAR_RE = /[\u0410-\u042F\u0430-\u044F\u0401\u0451-]/;

  let customEntries = {};
  let activeEditable = null;
  let hoverEnabled = false;
  let hoverTimer = null;
  let pageAccented = false;
  let pageOriginalNodes = [];

  const style = document.createElement("style");
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      z-index: 2147483646;
      width: 34px;
      height: 34px;
      border: 1px solid #b7c3d0;
      border-radius: 8px;
      background: #ffffff;
      color: #1f2937;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
      font: 700 17px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
    }
    #${BUTTON_ID}:hover {
      background: #eef6ff;
      border-color: #5b9ce6;
    }
    #${TOOLTIP_ID} {
      position: fixed;
      z-index: 2147483647;
      max-width: min(420px, calc(100vw - 24px));
      padding: 7px 9px;
      border: 1px solid #b7c3d0;
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
      font: 600 16px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
      display: none;
    }
    #${TOOLTIP_ID}[data-ambiguous="true"] {
      color: #7c2d12;
    }
  `;
  document.documentElement.appendChild(style);

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "\u0410\u0301";
  button.title = "添加俄语重音 (Alt+Shift+A)";
  button.setAttribute("aria-label", "添加俄语重音");
  document.documentElement.appendChild(button);

  const tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.setAttribute("role", "tooltip");
  document.documentElement.appendChild(tooltip);

  function loadSettings() {
    if (!globalThis.chrome?.storage?.local) return;
    globalThis.chrome.storage.local.get({ customDictionary: "", hoverEnabled: false }, (items) => {
      customEntries = RussianStress.parseCustomDictionary(items.customDictionary);
      hoverEnabled = Boolean(items.hoverEnabled);
    });
  }

  function isEditable(element) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) {
      return ["text", "search", "email", "url", "tel", ""].includes(element.type);
    }
    return false;
  }

  function getEditableFromTarget(target) {
    if (!target) return null;
    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    return element?.closest?.("textarea,input,[contenteditable='true'],[contenteditable='plaintext-only']") || null;
  }

  function rememberEditable(target) {
    const editable = getEditableFromTarget(target);
    if (!editable || !isEditable(editable)) return;
    activeEditable = editable;
    positionButton(editable);
  }

  function dispatchInput(element) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function replaceInputSelection(element, requireSelection = false) {
    if (element instanceof HTMLInputElement && element.type === "password") return false;
    const value = element.value;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? value.length;
    const hasSelection = end > start;
    if (requireSelection && !hasSelection) return false;
    const targetStart = hasSelection ? start : 0;
    const targetEnd = hasSelection ? end : value.length;
    const before = value.slice(0, targetStart);
    const selected = value.slice(targetStart, targetEnd);
    const after = value.slice(targetEnd);
    const accented = await RussianStress.stressTextAsync(selected, customEntries);
    if (accented === selected) return false;

    element.value = `${before}${accented}${after}`;
    element.setSelectionRange(targetStart, targetStart + accented.length);
    dispatchInput(element);
    return true;
  }

  function rememberedEditable() {
    if (activeEditable && activeEditable.isConnected && isEditable(activeEditable)) return activeEditable;
    activeEditable = null;
    return null;
  }

  function editableHasSelection(element) {
    if (!element || !isEditable(element)) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      return typeof start === "number" && typeof end === "number" && end > start;
    }
    return selectionInside(element);
  }

  function pageSelectionRange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString()) return null;
    return selection.getRangeAt(0);
  }

  function selectionInside(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    return element.contains(range.commonAncestorContainer);
  }

  function isUiOrHiddenText(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest(`#${BUTTON_ID}, #${TOOLTIP_ID}, script, style, noscript, textarea, input, select, option`));
  }

  function textSlicesInRange(range) {
    const ancestor = range.commonAncestorContainer;
    const root = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentNode;
    if (!root) return [];
    const slices = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || isUiOrHiddenText(node)) return NodeFilter.FILTER_REJECT;
        try {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
        } catch (_error) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue;
      let start = 0;
      let end = value.length;
      if (node === range.startContainer) start = Math.max(0, Math.min(value.length, range.startOffset));
      if (node === range.endContainer) end = Math.max(start, Math.min(value.length, range.endOffset));
      if (end <= start) continue;
      slices.push({ node, start, end, text: value.slice(start, end) });
    }
    return slices;
  }

  function canJoinSlices(slices) {
    if (slices.length <= 1) return true;
    const selector = "p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre,tr,section,article,td,th";
    const blockOf = (node) => node.parentElement?.closest(selector) || node.parentElement;
    const first = blockOf(slices[0].node);
    return slices.every((slice) => blockOf(slice.node) === first);
  }

  function writeSlice(slice, next) {
    const value = slice.node.nodeValue ?? "";
    slice.node.nodeValue = value.slice(0, slice.start) + next + value.slice(slice.end);
  }

  function placeCaretAfterNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentNode) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStart(node, node.nodeValue.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function accentTextInRange(range) {
    await RussianStress.loadStressData();
    const slices = textSlicesInRange(range);
    if (!slices.length) return false;
    if (canJoinSlices(slices)) {
      const distributed = RussianStress.splitAccented(slices.map((slice) => slice.text), customEntries);
      if (distributed && !distributed.changed) return false;
      if (distributed?.changed) {
        let changed = false;
        slices.forEach((slice, index) => {
          if (distributed.parts[index] === slice.text) return;
          writeSlice(slice, distributed.parts[index]);
          changed = true;
        });
        return changed;
      }
    }
    let changed = false;
    slices.forEach((slice) => {
      const next = RussianStress.stressText(slice.text, customEntries);
      if (next === slice.text) return;
      writeSlice(slice, next);
      changed = true;
    });
    return changed;
  }

  async function replaceContentEditableSelection(element) {
    if (!selectionInside(element)) return false;
    const range = pageSelectionRange();
    if (!range) return false;
    const changed = await accentTextInRange(range);
    if (!changed) return false;
    const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer : null;
    placeCaretAfterNode(endNode);
    dispatchInput(element);
    return true;
  }

  function shouldSkipTextNode(node, includeEditable) {
    if (!node.nodeValue || !CYRILLIC_RE.test(node.nodeValue)) return true;
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest(`#${BUTTON_ID}, #${TOOLTIP_ID}, script, style, noscript, svg, canvas, button, select, option`)) return true;
    if (!includeEditable && parent.closest("textarea,input,[contenteditable='true'],[contenteditable='plaintext-only']")) return true;
    return false;
  }

  async function replaceAllTextNodes(root, includeEditable = false, preserveOriginals = false) {
    await RussianStress.loadStressData();
    let changed = false;
    let changedNodes = 0;
    const originalNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkipTextNode(node, includeEditable) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const accented = RussianStress.stressText(node.nodeValue, customEntries);
      if (accented !== node.nodeValue) {
        if (preserveOriginals) originalNodes.push({ node, value: node.nodeValue });
        node.nodeValue = accented;
        changed = true;
        changedNodes += 1;
      }
    });

    if (changed && isEditable(root)) dispatchInput(root);
    return { changed, changedNodes, originalNodes };
  }

  async function accentWholeEditable(element) {
    if (!isEditable(element)) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return replaceInputSelection(element, false);
    }
    return (await replaceAllTextNodes(element, true)).changed;
  }

  async function accentEditableSelection(element) {
    if (!editableHasSelection(element)) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return replaceInputSelection(element, true);
    }
    return replaceContentEditableSelection(element);
  }

  async function accentPageSelection() {
    const range = pageSelectionRange();
    if (!range) return false;
    const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer : null;
    const changed = await accentTextInRange(range);
    if (changed) placeCaretAfterNode(endNode);
    return changed;
  }

  async function accentCurrentTarget() {
    const focused = getEditableFromTarget(document.activeElement);
    const focusedField = focused && isEditable(focused) ? focused : null;
    if (focusedField && editableHasSelection(focusedField)) return accentEditableSelection(focusedField);
    if (pageSelectionRange()) return accentPageSelection();
    const element = focusedField || rememberedEditable();
    if (element) return accentWholeEditable(element);
    return false;
  }

  async function accentSelectedText() {
    const range = pageSelectionRange();
    if (range) {
      const host = getEditableFromTarget(range.commonAncestorContainer);
      if (host && isEditable(host)) return accentEditableSelection(host);
      return accentPageSelection();
    }
    const focused = getEditableFromTarget(document.activeElement);
    const candidates = [focused && isEditable(focused) ? focused : null, rememberedEditable()];
    for (let index = 0; index < candidates.length; index += 1) {
      const element = candidates[index];
      if (element && editableHasSelection(element)) return accentEditableSelection(element);
    }
    return false;
  }

  async function accentReadablePage() {
    if (pageAccented) return { changed: false, changedNodes: 0, pageAccented: true };
    const result = await replaceAllTextNodes(document.body || document.documentElement, false, true);
    if (result.changed) {
      pageOriginalNodes = result.originalNodes;
      pageAccented = true;
    }
    return { changed: result.changed, changedNodes: result.changedNodes, pageAccented };
  }

  function restoreReadablePage() {
    let changedNodes = 0;
    pageOriginalNodes.forEach((entry) => {
      if (entry.node?.isConnected && entry.node.nodeValue !== entry.value) {
        entry.node.nodeValue = entry.value;
        changedNodes += 1;
      }
    });
    pageOriginalNodes = [];
    pageAccented = false;
    return { restored: true, changed: changedNodes > 0, changedNodes, pageAccented };
  }

  function positionButton(element) {
    if (!element) {
      button.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      button.style.display = "none";
      return;
    }

    button.style.left = `${Math.min(window.innerWidth - 42, Math.max(8, rect.right - 40))}px`;
    button.style.top = `${Math.min(window.innerHeight - 42, Math.max(8, rect.top + 8))}px`;
    button.style.display = "flex";
  }

  function getTextRangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      if (!position) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return null;
  }

  function wordAtPoint(x, y) {
    const range = getTextRangeFromPoint(x, y);
    const node = range?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE || shouldSkipTextNode(node, false)) return null;

    const text = node.nodeValue;
    let start = range.startOffset;
    let end = range.startOffset;
    if (!WORD_CHAR_RE.test(text[start] || "") && start > 0 && WORD_CHAR_RE.test(text[start - 1])) {
      start -= 1;
      end -= 1;
    }
    while (start > 0 && WORD_CHAR_RE.test(text[start - 1])) start -= 1;
    while (end < text.length && WORD_CHAR_RE.test(text[end])) end += 1;

    const word = text.slice(start, end).replace(/^-+|-+$/g, "");
    return CYRILLIC_RE.test(word) ? word : null;
  }

  function showTooltip(event, result) {
    tooltip.textContent = result.forms.join(" / ");
    tooltip.dataset.ambiguous = String(result.ambiguous);
    tooltip.style.left = `${Math.min(window.innerWidth - 12, event.clientX + 12)}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 12, event.clientY + 14)}px`;
    tooltip.style.display = "block";
  }

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function scheduleHoverLookup(event) {
    if (!hoverEnabled || getEditableFromTarget(event.target)) {
      hideTooltip();
      return;
    }
    clearTimeout(hoverTimer);
    const x = event.clientX;
    const y = event.clientY;
    hoverTimer = setTimeout(async () => {
      const word = wordAtPoint(x, y);
      if (!word) {
        hideTooltip();
        return;
      }
      const result = await RussianStress.lookupWordAsync(word, customEntries);
      if (!result || result.forms.every((form) => form === word)) {
        hideTooltip();
        return;
      }
      showTooltip(event, result);
    }, 160);
  }

  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", async () => {
    await accentCurrentTarget();
    positionButton(activeEditable);
  });

  document.addEventListener("focusin", (event) => {
    rememberEditable(event.target);
  });

  document.addEventListener("mousedown", (event) => {
    rememberEditable(event.target);
  }, true);

  document.addEventListener("selectionchange", () => {
    rememberEditable(document.activeElement);
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!document.activeElement || !isEditable(getEditableFromTarget(document.activeElement))) {
        button.style.display = "none";
      }
    }, 150);
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.code === "KeyA") {
      event.preventDefault();
      accentCurrentTarget();
    }
  });

  document.addEventListener("mousemove", scheduleHoverLookup);
  document.addEventListener("mouseleave", hideTooltip);
  window.addEventListener("resize", () => positionButton(activeEditable));
  window.addEventListener("scroll", () => positionButton(activeEditable), true);

  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.customDictionary) customEntries = RussianStress.parseCustomDictionary(changes.customDictionary.newValue);
    if (changes.hoverEnabled) hoverEnabled = Boolean(changes.hoverEnabled.newValue);
  });

  globalThis.chrome?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message?.type === "accent-current") {
      accentCurrentTarget().then((changed) => sendResponse({ ok: true, changed })).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "accent-selection") {
      accentSelectedText().then((changed) => sendResponse({ ok: true, changed })).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "accent-page") {
      accentReadablePage().then((result) => sendResponse({ ok: true, ...result })).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "restore-page") {
      sendResponse({ ok: true, ...restoreReadablePage() });
      return true;
    }
    if (message?.type === "get-state") {
      sendResponse({ ok: true, pageAccented, hoverEnabled });
      return true;
    }
    if (message?.type === "set-hover") {
      hoverEnabled = Boolean(message.enabled);
      hideTooltip();
      sendResponse({ ok: true, hoverEnabled });
      return true;
    }
    return undefined;
  });

  loadSettings();
})();
