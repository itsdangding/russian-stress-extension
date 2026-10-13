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
  let pageOriginalInputs = [];

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
  button.title = "添加/取消俄语重音 (Alt+Shift+A)";
  button.setAttribute("aria-label", "添加或取消俄语重音");
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
    let resultText = accented;
    let unaccented = false;

    if (accented === selected) {
      if (selected.includes(RussianStress.ACUTE)) {
        resultText = RussianStress.stripStress(selected);
        unaccented = true;
      } else {
        return false;
      }
    }

    element.value = `${before}${resultText}${after}`;
    element.setSelectionRange(targetStart, targetStart + resultText.length);
    dispatchInput(element);
    return { changed: true, unaccented };
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

    const originalText = slices.map((slice) => slice.text).join("");
    const accentedText = RussianStress.stressText(originalText, customEntries);
    let shouldUnaccent = false;
    if (accentedText === originalText && originalText.includes(RussianStress.ACUTE)) {
      shouldUnaccent = true;
    }

    if (shouldUnaccent) {
      let changed = false;
      slices.forEach((slice) => {
        const stripped = RussianStress.stripStress(slice.text);
        if (stripped !== slice.text) {
          writeSlice(slice, stripped);
          changed = true;
        }
      });
      return { changed, unaccented: true };
    }

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
        return { changed, unaccented: false };
      }
    }
    let changed = false;
    slices.forEach((slice) => {
      const next = RussianStress.stressText(slice.text, customEntries);
      if (next === slice.text) return;
      writeSlice(slice, next);
      changed = true;
    });
    return { changed, unaccented: false };
  }

  async function replaceContentEditableSelection(element) {
    if (!selectionInside(element)) return false;
    const range = pageSelectionRange();
    if (!range) return false;
    const result = await accentTextInRange(range);
    if (!result || (result.changed === false && !result.unaccented)) return false;
    const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer : null;
    placeCaretAfterNode(endNode);
    dispatchInput(element);
    return result;
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
    const range = document.createRange();
    range.selectNodeContents(element);
    const result = await accentTextInRange(range);
    if (result && (result.changed || result.unaccented)) {
      dispatchInput(element);
    }
    return result;
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
    const result = await accentTextInRange(range);
    if (result && (result.changed || result.unaccented)) placeCaretAfterNode(endNode);
    return result;
  }

  async function accentCurrentTarget() {
    const focused = getEditableFromTarget(document.activeElement);
    const focusedField = focused && isEditable(focused) ? focused : null;
    if (focusedField && editableHasSelection(focusedField)) return accentEditableSelection(focusedField);
    if (pageSelectionRange()) return accentPageSelection();
    const element = focusedField || rememberedEditable();
    if (element) return accentWholeEditable(element);

    const frameRes = await forwardActionToSubframes("accent-current");
    if (frameRes) return frameRes;

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

  let pageObserver = null;
  let observerTimer = null;

  function startPageObserver() {
    if (pageObserver || typeof MutationObserver === "undefined") return;
    const targetRoot = document.body || document.documentElement;
    if (!targetRoot) return;

    pageObserver = new MutationObserver((mutations) => {
      if (!pageAccented) return;

      let hasRelevant = false;
      for (let i = 0; i < mutations.length; i += 1) {
        const m = mutations[i];
        if (m.target?.closest?.(`#${BUTTON_ID}, #${TOOLTIP_ID}`)) continue;
        if (m.type === "childList" && m.addedNodes.length > 0) {
          for (let j = 0; j < m.addedNodes.length; j += 1) {
            const node = m.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.id === BUTTON_ID || node.id === TOOLTIP_ID) continue;
              if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(node.tagName)) continue;
              hasRelevant = true;
              break;
            } else if (node.nodeType === Node.TEXT_NODE && CYRILLIC_RE.test(node.nodeValue)) {
              hasRelevant = true;
              break;
            }
          }
        }
        if (hasRelevant) break;
      }

      if (!hasRelevant) return;

      clearTimeout(observerTimer);
      observerTimer = setTimeout(async () => {
        if (!pageAccented || !pageObserver) return;
        pageObserver.disconnect();
        try {
          const result = await replaceAllTextNodes(document.body || document.documentElement, true, true);
          if (result.changed) {
            pageOriginalNodes.push(...result.originalNodes);
          }

          const root = document.body || document.documentElement;
          const editables = root.querySelectorAll("textarea, input");
          editables.forEach((el) => {
            if (!isEditable(el)) return;
            if (el instanceof HTMLInputElement && el.type === "password") return;
            if (el === document.activeElement) return;
            if (pageOriginalInputs.some((entry) => entry.element === el)) return;
            const val = el.value;
            if (!val || !CYRILLIC_RE.test(val)) return;
            const accented = RussianStress.stressText(val, customEntries);
            if (accented !== val) {
              pageOriginalInputs.push({ element: el, value: val });
              el.value = accented;
              dispatchInput(el);
            }
          });
        } finally {
          if (pageAccented && pageObserver) {
            pageObserver.observe(document.body || document.documentElement, {
              childList: true,
              subtree: true
            });
          }
        }
      }, 300);
    });

    pageObserver.observe(targetRoot, {
      childList: true,
      subtree: true
    });
  }

  function stopPageObserver() {
    clearTimeout(observerTimer);
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
  }

  function forwardActionToSubframes(action, payload = {}) {
    return new Promise((resolve) => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      if (!iframes.length) {
        resolve(false);
        return;
      }
      let settled = false;
      const handler = (event) => {
        if (event.data?.type === "__RUSSIAN_STRESS_RESPONSE__" && event.data.action === action) {
          settled = true;
          window.removeEventListener("message", handler);
          resolve(event.data.result);
        }
      };
      window.addEventListener("message", handler);
      setTimeout(() => {
        if (!settled) {
          window.removeEventListener("message", handler);
          resolve(false);
        }
      }, 350);

      iframes.forEach((f) => {
        try {
          f.contentWindow?.postMessage({ type: "__RUSSIAN_STRESS_ACTION__", action, ...payload }, "*");
        } catch (_e) {}
      });
    });
  }

  window.addEventListener("message", async (event) => {
    if (event.data?.type === "__RUSSIAN_STRESS_ACTION__") {
      const action = event.data.action;
      if (action === "accent-current") {
        const focused = getEditableFromTarget(document.activeElement) || rememberedEditable();
        if (focused && isEditable(focused)) {
          const res = await accentCurrentTarget();
          event.source?.postMessage({
            type: "__RUSSIAN_STRESS_RESPONSE__",
            action,
            result: res
          }, "*");
        }
      } else if (action === "accent-page") {
        const res = await accentReadablePage();
        event.source?.postMessage({
          type: "__RUSSIAN_STRESS_RESPONSE__",
          action,
          result: res
        }, "*");
      } else if (action === "restore-page") {
        const res = restoreReadablePage();
        event.source?.postMessage({
          type: "__RUSSIAN_STRESS_RESPONSE__",
          action,
          result: res
        }, "*");
      }
    }
  });

  async function accentReadablePage() {
    if (pageAccented) return { changed: false, changedNodes: 0, pageAccented: true };
    await RussianStress.loadStressData();
    let totalChanged = false;
    let totalChangedNodes = 0;

    const result = await replaceAllTextNodes(document.body || document.documentElement, true, true);
    if (result.changed) {
      pageOriginalNodes = result.originalNodes;
      totalChanged = true;
      totalChangedNodes += result.changedNodes;
    }

    pageOriginalInputs = [];
    const root = document.body || document.documentElement;
    const editables = root.querySelectorAll("textarea, input");
    editables.forEach((el) => {
      if (!isEditable(el)) return;
      if (el instanceof HTMLInputElement && el.type === "password") return;
      const val = el.value;
      if (!val || !CYRILLIC_RE.test(val)) return;
      const accented = RussianStress.stressText(val, customEntries);
      if (accented !== val) {
        pageOriginalInputs.push({ element: el, value: val });
        el.value = accented;
        dispatchInput(el);
        totalChanged = true;
        totalChangedNodes += 1;
      }
    });

    const subframeRes = await forwardActionToSubframes("accent-page");
    if (subframeRes?.changed) {
      totalChanged = true;
      totalChangedNodes += (subframeRes.changedNodes || 0);
    }

    if (totalChanged) {
      pageAccented = true;
      startPageObserver();
    }
    return { changed: totalChanged, changedNodes: totalChangedNodes, pageAccented };
  }

  function restoreReadablePage() {
    stopPageObserver();
    forwardActionToSubframes("restore-page");

    let changedNodes = 0;
    pageOriginalNodes.forEach((entry) => {
      if (entry.node?.isConnected && entry.node.nodeValue !== entry.value) {
        entry.node.nodeValue = entry.value;
        changedNodes += 1;
      }
    });
    pageOriginalNodes = [];

    pageOriginalInputs.forEach((entry) => {
      if (entry.element?.isConnected && entry.element.value !== entry.value) {
        entry.element.value = entry.value;
        dispatchInput(entry.element);
        changedNodes += 1;
      }
    });
    pageOriginalInputs = [];

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
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
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

  function getWordFromInputOrTextarea(element, x, y) {
    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) return null;
    if (element instanceof HTMLInputElement && element.type === "password") return null;

    const value = element.value;
    if (!value || !CYRILLIC_RE.test(value)) return null;

    const rect = element.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;

    const computed = window.getComputedStyle(element);
    const mirror = document.createElement("div");
    const copyProps = [
      "fontFamily", "fontSize", "fontWeight", "fontStyle",
      "letterSpacing", "wordSpacing", "textIndent",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "boxSizing", "lineHeight"
    ];
    copyProps.forEach((prop) => { mirror.style[prop] = computed[prop]; });
    mirror.style.position = "fixed";
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top}px`;
    mirror.style.width = `${rect.width}px`;
    mirror.style.height = `${rect.height}px`;
    mirror.style.whiteSpace = element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "break-word";
    mirror.style.overflow = "hidden";
    mirror.style.visibility = "visible";
    mirror.style.opacity = "0";
    mirror.style.pointerEvents = "auto";
    mirror.style.zIndex = "2147483645";
    mirror.textContent = value;
    mirror.scrollTop = element.scrollTop;
    mirror.scrollLeft = element.scrollLeft;

    (document.body || document.documentElement).appendChild(mirror);
    let word = null;
    try {
      const range = getTextRangeFromPoint(x, y);
      const node = range?.startContainer;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || "";
        let start = range.startOffset;
        let end = range.startOffset;
        if (!WORD_CHAR_RE.test(text[start] || "") && start > 0 && WORD_CHAR_RE.test(text[start - 1])) {
          start -= 1;
          end -= 1;
        }
        while (start > 0 && WORD_CHAR_RE.test(text[start - 1])) start -= 1;
        while (end < text.length && WORD_CHAR_RE.test(text[end])) end += 1;
        const candidate = text.slice(start, end).replace(/^-+|-+$/g, "");
        if (CYRILLIC_RE.test(candidate)) word = candidate;
      }
    } finally {
      mirror.remove();
    }
    return word;
  }

  function wordAtPoint(x, y) {
    if (document.elementFromPoint) {
      const target = document.elementFromPoint(x, y);
      if (target && target.closest(`#${BUTTON_ID}, #${TOOLTIP_ID}, script, style, noscript`)) return null;
      const inputOrTextarea = target?.closest?.("textarea, input");
      if (inputOrTextarea && isEditable(inputOrTextarea)) {
        return getWordFromInputOrTextarea(inputOrTextarea, x, y);
      }
    }

    const range = getTextRangeFromPoint(x, y);
    const node = range?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE || shouldSkipTextNode(node, true)) return null;

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
    tooltip.style.display = "block";

    const width = tooltip.offsetWidth || 180;
    const height = tooltip.offsetHeight || 36;
    let left = event.clientX + 12;
    let top = event.clientY + 14;

    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, event.clientX - width - 12);
    }
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, event.clientY - height - 12);
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function scheduleHoverLookup(event) {
    if (!hoverEnabled) {
      hideTooltip();
      return;
    }
    if (event.target?.closest?.(`#${BUTTON_ID}, #${TOOLTIP_ID}`)) {
      return;
    }
    if (event.target instanceof HTMLInputElement && event.target.type === "password") {
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

  document.addEventListener("input", (event) => {
    rememberEditable(event.target);
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
      accentCurrentTarget().then((res) => {
        const changed = Boolean(res?.changed ?? res);
        const unaccented = Boolean(res?.unaccented);
        sendResponse({ ok: true, changed, unaccented });
      }).catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "accent-selection") {
      accentSelectedText().then((res) => {
        const changed = Boolean(res?.changed ?? res);
        const unaccented = Boolean(res?.unaccented);
        sendResponse({ ok: true, changed, unaccented });
      }).catch((error) => sendResponse({ ok: false, error: error.message }));
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
