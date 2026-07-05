chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-page",
    title: "保存当前网页到知脉",
    contexts: ["page"],
  });

  chrome.contextMenus.create({
    id: "save-selection",
    title: "保存选中文本到知脉",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const payload = {
    sourceTitle: tab.title ?? "未命名网页",
    sourceUrl: tab.url ?? "",
    selectedText: info.selectionText ?? "",
    rawContent: info.selectionText || tab.title || tab.url || "",
    sourceType: "web",
  };

  await saveCapture(payload);
});

async function saveCapture(payload) {
  const { apiBaseUrl = "http://localhost:3001", accessToken = "" } = await chrome.storage.sync.get([
    "apiBaseUrl",
    "accessToken",
  ]);
  const response = await fetch(`${apiBaseUrl}/api/captures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("保存失败");
  }

  return response.json();
}
