"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const accentCode = fs.readFileSync(path.join(root, "accent.js"), "utf8");
const contentCode = fs.readFileSync(path.join(root, "content.js"), "utf8");
const dictionary = JSON.parse(fs.readFileSync(path.join(root, "stress-data.json"), "utf8"));
const ACUTE = "\u0301";
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function loadAccent(extra = {}) {
  const context = { console, ...extra };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(accentCode, context);
  return context;
}

function badMark(text) {
  return text.includes(`\u0451${ACUTE}`) || text.includes(`\u0401${ACUTE}`) || text.includes(`${ACUTE}${ACUTE}`);
}

function runDictionaryTests() {
  const context = loadAccent();
  context.RussianStressData = dictionary;
  const stress = context.RussianStress;
  const cases = [
    ["письмо", "письмо\u0301"],
    ["хорошо", "хорошо\u0301"],
    ["говорить", "говори\u0301ть"],
    ["москва", "москва\u0301"],
    ["Москва", "Москва\u0301"],
    ["МОСКВА", "МОСКВА\u0301"],
    ["еще", "ещё"],
    ["ее", "её"],
    ["взлета", "взлёта"],
    ["взлёта", "взлёта"],
    ["взлё\u0301та", "взлёта"],
    ["украина", "украи\u0301на"],
    ["замок", "замок"],
    ["все", "все"],
    ["всё", "всё"]
  ];

  cases.forEach(([input, expected]) => {
    const once = stress.stressText(input, {});
    const twice = stress.stressText(once, {});
    assert(once === expected, `stress(${input}) => ${JSON.stringify(once)}, expected ${JSON.stringify(expected)}`);
    assert(twice === once, `second pass changed ${input}: ${JSON.stringify(once)} => ${JSON.stringify(twice)}`);
    assert(!badMark(once), `bad mark in ${input}: ${JSON.stringify(once)}`);
  });

  const custom = stress.stressText("елка", { елка: "ё\u0301лка" });
  assert(custom === "ёлка", `custom ё́ was not cleaned: ${JSON.stringify(custom)}`);
  assert(stress.stressText(custom, { елка: "ё\u0301лка" }) === custom, "custom form was not stable");

  const looked = stress.lookupWord("взлета", {});
  assert(looked && looked.forms.every((form) => !form.includes(`\u0451${ACUTE}`)), `lookup взлета => ${JSON.stringify(looked)}`);
  const ambiguous = stress.lookupWord("замок", {});
  assert(ambiguous && ambiguous.ambiguous && ambiguous.forms.length > 1, `замок should stay ambiguous: ${JSON.stringify(ambiguous)}`);

  const joined = stress.splitAccented(["при", "мер"], {});
  assert(joined && joined.changed && joined.parts.join("") === "приме\u0301р", `split word => ${JSON.stringify(joined)}`);
  assert(joined.parts[0] === "при" && joined.parts[1] === "ме\u0301р", `split parts => ${JSON.stringify(joined && joined.parts)}`);

  const sentence = "Это письмо и хорошо, еще можно говорить.";
  const accentedSentence = stress.stressText(sentence, {});
  assert(accentedSentence === "Э\u0301то письмо\u0301 и хорошо\u0301, ещё мо\u0301жно говори\u0301ть.", `sentence => ${JSON.stringify(accentedSentence)}`);
  assert(stress.stressText(accentedSentence, {}) === accentedSentence, "sentence was not stable");
  assert(!badMark(accentedSentence), `sentence bad mark ${JSON.stringify(accentedSentence)}`);

  let checked = 0;
  Object.entries(dictionary).forEach(([key, value]) => {
    const forms = Array.isArray(value) ? value : [value];
    forms.forEach((form) => {
      const cleaned = stress.stressText(form, {});
      const again = stress.stressText(cleaned, {});
      checked += 1;
      if (cleaned !== again || badMark(cleaned)) {
        if (failures.length < 12) failures.push(`value ${key} => ${JSON.stringify(form)} => ${JSON.stringify(cleaned)} => ${JSON.stringify(again)}`);
      }
    });
    const once = stress.stressText(key, {});
    const twice = stress.stressText(once, {});
    checked += 1;
    if (once !== twice || badMark(once)) {
      if (failures.length < 12) failures.push(`key ${key} => ${JSON.stringify(once)} => ${JSON.stringify(twice)}`);
    }
  });
  console.log(`dictionary checks: ${checked}`);
}

async function runRetryTest() {
  let calls = 0;
  const context = loadAccent({
    fetch(url) {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("offline"));
      assert(url.endsWith("stress-data.json"), `unexpected url ${url}`);
      return Promise.resolve({
        ok: true,
        json: async () => ({ письмо: "письмо\u0301" })
      });
    },
    chrome: { runtime: { getURL: (file) => `chrome-extension://test/${file}` } }
  });
  const first = await context.RussianStress.loadStressData().then(() => "ok", (error) => error.message);
  assert(first === "offline", `first load should fail, got ${first}`);
  const loaded = await context.RussianStress.loadStressData();
  assert(loaded.письмо === "письмо\u0301", "second load did not retry");
  assert(calls === 2, `fetch calls ${calls}`);
}

function selectRange(window, startNode, startOffset, endNode, endOffset) {
  const range = window.document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

function textNode(element) {
  const walker = element.ownerDocument.createTreeWalker(element, element.ownerDocument.defaultView.NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

async function send(listener, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error(`no response for ${message.type}`));
    }, 5000);
    const returned = listener(message, {}, (response) => {
      settled = true;
      clearTimeout(timer);
      resolve(response);
    });
    if (returned !== true && !settled) {
      clearTimeout(timer);
      reject(new Error(`listener did not stay async for ${message.type}`));
    }
  });
}

async function runDomTests() {
  let JSDOM;
  try {
    ({ JSDOM } = require("jsdom"));
  } catch (error) {
    failures.push(`jsdom is unavailable: ${error.message}`);
    return;
  }

  const dom = new JSDOM(`<!doctype html><html><body>
    <p id="article">Это <b>письмо</b> и <a href="https://example.com/x">хорошо</a>.</p>
    <p id="split"><b>при</b>мер</p>
    <p id="other">город</p>
    <p id="fresh">можно</p>
    <input id="secret" type="password" value="секрет">
    <input id="box" type="text" value="письмо">
    <textarea id="area">пример</textarea>
    <div id="editor" contenteditable="true">замок и город</div>
  </body></html>`, { url: "https://example.com/", pretendToBeVisual: true, runScripts: "dangerously" });
  const { window } = dom;
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 120, height: 24, top: 8, right: 120, left: 0, bottom: 32
  });
  let listener = null;
  window.chrome = {
    storage: {
      local: {
        get(_defaults, callback) { callback({ customDictionary: "", hoverEnabled: false }); }
      },
      onChanged: { addListener() {} }
    },
    runtime: {
      getURL: (file) => `chrome-extension://test/${file}`,
      onMessage: { addListener(fn) { listener = fn; } }
    }
  };
  window.RussianStressData = dictionary;
  [accentCode, contentCode].forEach((code) => {
    const script = window.document.createElement("script");
    script.textContent = code;
    window.document.documentElement.appendChild(script);
  });
  assert(listener, "content script did not register a message listener");

  const secret = window.document.getElementById("secret");
  const box = window.document.getElementById("box");
  const article = window.document.getElementById("article");
  const split = window.document.getElementById("split");
  const other = window.document.getElementById("other");
  const editor = window.document.getElementById("editor");
  const fresh = window.document.getElementById("fresh");
  const button = window.document.getElementById("russian-stress-floating-button");
  let inputEvents = 0;
  box.addEventListener("input", () => { inputEvents += 1; });

  secret.focus();
  assert(button.style.display !== "flex", "password field showed the accent button");
  const secretResult = await send(listener, { type: "accent-current" });
  assert(secretResult && secretResult.changed === false, `password accent changed=${secretResult && secretResult.changed}`);
  assert(secret.value === "секрет", `password value changed to ${secret.value}`);

  box.focus();
  const first = await send(listener, { type: "accent-current" });
  assert(first.changed === true, "text input was not accented");
  assert(box.value === "письмо\u0301", `input value ${JSON.stringify(box.value)}`);

  const second = await send(listener, { type: "accent-current" });
  assert(second.changed === true && second.unaccented === true, "second input accent did not unaccent");
  assert(box.value === "письмо", `input value after unaccent ${JSON.stringify(box.value)}`);

  const third = await send(listener, { type: "accent-current" });
  assert(third.changed === true && !third.unaccented, "third input accent did not re-accent");
  assert(box.value === "письмо\u0301", `input value after re-accent ${JSON.stringify(box.value)}`);
  assert(!badMark(box.value), `input has a bad mark ${JSON.stringify(box.value)}`);
  assert(inputEvents === 3, `input events ${inputEvents}`);

  const articleNodes = textNode(article);
  selectRange(window, articleNodes[0], 0, articleNodes[articleNodes.length - 1], articleNodes[articleNodes.length - 1].nodeValue.length);
  const selected = await send(listener, { type: "accent-selection" });
  assert(selected.changed === true, "article selection was not accented");
  assert(article.querySelector("b") && article.querySelector("a").getAttribute("href") === "https://example.com/x", `markup lost: ${article.innerHTML}`);
  assert(article.textContent.includes("письмо\u0301") && article.textContent.includes("хорошо\u0301"), `article text ${JSON.stringify(article.textContent)}`);
  assert(!badMark(article.textContent), `article bad mark ${JSON.stringify(article.textContent)}`);

  const splitNodes = textNode(split);
  selectRange(window, splitNodes[0], 0, splitNodes[splitNodes.length - 1], splitNodes[splitNodes.length - 1].nodeValue.length);
  const splitResult = await send(listener, { type: "accent-selection" });
  assert(splitResult.changed === true, "split word was not accented");
  assert(split.querySelector("b"), `bold tag lost: ${split.innerHTML}`);
  assert(split.textContent === "приме\u0301р", `split text ${JSON.stringify(split.textContent)}`);

  box.setSelectionRange(0, 0);
  editor.focus();
  const editorNodes = textNode(editor);
  const editorText = editorNodes[0];
  selectRange(window, editorText, 0, editorText, "замок".length);
  const partial = await send(listener, { type: "accent-current" });
  assert(partial.changed === false, "ambiguous selection should not change");
  assert(editor.textContent === "замок и город", `editor was rewritten: ${JSON.stringify(editor.textContent)}`);

  box.value = "город";
  box.blur();
  other.focus();
  const otherNode = textNode(other)[0];
  selectRange(window, otherNode, 0, otherNode, otherNode.nodeValue.length);
  const stale = await send(listener, { type: "accent-current" });
  assert(stale.changed === true, "page selection was not accented");
  assert(box.value === "город", `stale input was edited: ${box.value}`);
  assert(other.textContent === "го\u0301род", `other text ${JSON.stringify(other.textContent)}`);

  const area = window.document.getElementById("area");
  const page = await send(listener, { type: "accent-page" });
  assert(page.ok && page.pageAccented, `page accent failed ${JSON.stringify(page)}`);
  assert(fresh.textContent === "мо\u0301жно", `fresh text ${JSON.stringify(fresh.textContent)}`);
  assert(box.value === "го\u0301род", `box input was not accented by page accent: ${box.value}`);
  assert(area.value === "приме\u0301р", `textarea was not accented by page accent: ${area.value}`);
  assert(secret.value === "секрет", `password was modified by page accent: ${secret.value}`);

  const dyn = window.document.createElement("p");
  dyn.id = "dyn";
  dyn.textContent = "свежие новости";
  window.document.body.appendChild(dyn);

  await new Promise((r) => setTimeout(r, 450));
  assert(dyn.textContent.includes("све\u0301жие") || dyn.textContent.includes("но\u0301вости"), `dynamic news node was not accented: ${dyn.textContent}`);

  const restored = await send(listener, { type: "restore-page" });
  assert(restored.restored === true, `restore failed ${JSON.stringify(restored)}`);
  assert(fresh.textContent === "можно", `restore left ${JSON.stringify(fresh.textContent)}`);
  assert(box.value === "город", `box input was not restored: ${box.value}`);
  assert(area.value === "пример", `textarea was not restored: ${area.value}`);
  assert(secret.value === "секрет", `password was modified on restore: ${secret.value}`);
  assert(dyn.textContent === "свежие новости", `dynamic news node was not restored: ${dyn.textContent}`);
}

async function main() {
  try {
    runDictionaryTests();
    await runRetryTest();
    await runDomTests();
  } catch (error) {
    failures.push(error && error.stack ? error.stack : String(error));
  }
  if (failures.length) {
    console.error(`FAILED ${failures.length}`);
    failures.slice(0, 30).forEach((failure) => console.error(failure));
    process.exitCode = 1;
    return;
  }
  console.log("PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
