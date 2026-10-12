const textarea = document.getElementById("custom-dictionary");
const status = document.getElementById("status");

function setStatus(text) {
  status.textContent = text;
}

chrome.storage.local.get({ customDictionary: "" }, (items) => {
  textarea.value = items.customDictionary;
});

document.getElementById("save").addEventListener("click", () => {
  const parsed = RussianStress.parseCustomDictionary(textarea.value);
  chrome.storage.local.set({ customDictionary: textarea.value }, () => {
    setStatus(`已保存 ${Object.keys(parsed).length} 个自定义词条。`);
  });
});

document.getElementById("reset").addEventListener("click", () => {
  textarea.value = "";
  chrome.storage.local.set({ customDictionary: "" }, () => {
    setStatus("自定义词典已清空。");
  });
});
