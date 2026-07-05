const state = {
  accessToken: "",
  apiBaseUrl: "http://localhost:3001",
  tab: null,
};

const fields = {
  accessToken: document.querySelector("#access-token"),
  apiBaseUrl: document.querySelector("#api-base-url"),
  note: document.querySelector("#note"),
  openWeb: document.querySelector("#open-web"),
  pageTitle: document.querySelector("#page-title"),
  pageUrl: document.querySelector("#page-url"),
  save: document.querySelector("#save"),
  selectedText: document.querySelector("#selected-text"),
  status: document.querySelector("#status"),
};

init();

async function init() {
  const storage = await chrome.storage.sync.get(["apiBaseUrl", "accessToken"]);
  state.apiBaseUrl = storage.apiBaseUrl || state.apiBaseUrl;
  state.accessToken = storage.accessToken || state.accessToken;
  fields.apiBaseUrl.value = state.apiBaseUrl;
  fields.accessToken.value = state.accessToken;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;

  fields.pageTitle.value = tab?.title || "";
  fields.pageUrl.textContent = tab?.url || "未读取到网页地址";

  const selectedText = await readSelectedText(tab?.id);
  fields.selectedText.value = selectedText;
}

fields.save.addEventListener("click", async () => {
  state.apiBaseUrl = fields.apiBaseUrl.value.trim() || state.apiBaseUrl;
  state.accessToken = fields.accessToken.value.trim();
  await chrome.storage.sync.set({
    accessToken: state.accessToken,
    apiBaseUrl: state.apiBaseUrl,
  });

  const title = fields.pageTitle.value.trim() || state.tab?.title || "未命名网页";
  const selectedText = fields.selectedText.value.trim();
  const note = fields.note.value.trim();
  const rawContent = selectedText || title;

  setStatus("保存中...");
  fields.save.disabled = true;

  try {
    const response = await fetch(`${state.apiBaseUrl}/api/captures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
      },
      body: JSON.stringify({
        sourceTitle: title,
        sourceUrl: state.tab?.url || "",
        selectedText,
        rawContent,
        note,
        sourceType: "web",
      }),
    });

    if (response.status === 401) {
      throw new Error("请先填写访问令牌");
    }

    if (!response.ok) {
      throw new Error("保存失败");
    }

    setStatus("已发送到你的收集箱");
  } catch {
    setStatus("保存失败，请确认 Web 地址和访问令牌");
  } finally {
    fields.save.disabled = false;
  }
});

fields.openWeb.addEventListener("click", async () => {
  await chrome.tabs.create({ url: state.apiBaseUrl });
});

async function readSelectedText(tabId) {
  if (!tabId) return "";

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString() || "",
    });

    return result?.result || "";
  } catch {
    return "";
  }
}

function setStatus(text) {
  fields.status.textContent = text;
}
