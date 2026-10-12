const labels = {
  accentPage: "给当前页面加重音",
  restorePage: "取消当前页面重音",
  enableHover: "开启悬停查词",
  disableHover: "关闭悬停查词"
};

let hoverEnabled = false;
let pageAccented = false;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function sendToActiveTab(type, payload = {}) {
  const tab = await getActiveTab();
  try {
    return await chrome.tabs.sendMessage(tab.id, { type, ...payload });
  } catch (error) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["accent.js", "content.js"] });
    return chrome.tabs.sendMessage(tab.id, { type, ...payload });
  }
}

async function setHoverState(enabled) {
  await chrome.storage.local.set({ hoverEnabled: enabled });
  return sendToActiveTab("set-hover", { enabled });
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function renderHoverButton() {
  document.getElementById("toggle-hover").textContent = hoverEnabled ? labels.disableHover : labels.enableHover;
}

function renderPageButton() {
  document.getElementById("accent-page").textContent = pageAccented ? labels.restorePage : labels.accentPage;
}

async function syncState() {
  chrome.storage.local.get({ hoverEnabled: false }, async (items) => {
    hoverEnabled = Boolean(items.hoverEnabled);
    renderHoverButton();
    try {
      const response = await sendToActiveTab("get-state");
      pageAccented = Boolean(response?.pageAccented);
      renderPageButton();
    } catch (_error) {
      pageAccented = false;
      renderPageButton();
    }
  });
}

document.getElementById("accent-page").addEventListener("click", async () => {
  try {
    setStatus(pageAccented ? "正在恢复原文..." : "正在加载本地词典...");
    const response = await sendToActiveTab(pageAccented ? "restore-page" : "accent-page");
    if (!response?.ok) throw new Error(response?.error || "Page update failed.");
    pageAccented = Boolean(response.pageAccented);
    renderPageButton();
    if (response.restored) {
      setStatus(`已恢复 ${response.changedNodes} 个文本块。`);
    } else {
      setStatus(response.changed ? `已处理 ${response.changedNodes} 个文本块。` : "没有找到可确定重音的词。");
    }
  } catch (error) {
    setStatus("请打开普通网页后再试。浏览器内部页面不支持。");
  }
});

document.getElementById("toggle-hover").addEventListener("click", async () => {
  const nextEnabled = !hoverEnabled;
  try {
    const response = await setHoverState(nextEnabled);
    hoverEnabled = Boolean(response?.hoverEnabled ?? nextEnabled);
    renderHoverButton();
    setStatus(hoverEnabled ? "悬停查词已开启。" : "悬停查词已关闭。");
  } catch (error) {
    setStatus("请打开普通网页后再试。浏览器内部页面不支持。");
  }
});

document.getElementById("accent-current").addEventListener("click", async () => {
  try {
    const response = await sendToActiveTab("accent-current");
    setStatus(response?.changed ? "已给光标所在输入框添加重音。" : "请先把光标放进输入框，或选择文本。");
  } catch (error) {
    setStatus("请打开普通网页后再试。浏览器内部页面不支持。");
  }
});

document.getElementById("accent-selection").addEventListener("click", async () => {
  try {
    const response = await sendToActiveTab("accent-selection");
    setStatus(response?.changed ? "已给选中文本添加重音。" : "请先选择俄语文本。");
  } catch (error) {
    setStatus("请打开普通网页后再试。浏览器内部页面不支持。");
  }
});

document.getElementById("open-options").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

syncState();
