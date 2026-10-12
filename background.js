chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "accent-current-field") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "accent-current" });
  } catch (error) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["accent.js", "content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "accent-current" });
    } catch (_error) {
      // The active page may not match the extension host permissions.
    }
  }
});
