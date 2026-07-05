const captures = [
  {
    id: "c1",
    title: "知识管理不是收藏",
    source: "手动输入",
    status: "待确认",
    type: "观点",
    action: "创建新页面",
    links: 3,
    topics: ["知识管理", "个人 Wiki", "认知结构"],
    summary:
      "这段内容适合沉淀成知脉的核心理念：知识管理的价值不在保存，而在把信息转化为可解释、可复用的认知结构。",
    draft: `
      <h1>知识管理的核心是重构认知结构</h1>
      <h2>一句话解释</h2>
      <p>知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。</p>
      <h2>背景与上下文</h2>
      <p>很多人把知识管理理解为收藏文章、保存摘录或建立文件夹，但这些动作本身并不等于形成知识。信息只有进入个人的概念、方法和判断体系，才真正变成可复用的知识。</p>
      <h2>核心观点</h2>
      <ul>
        <li>收藏解决的是信息留存问题，重构解决的是理解和复用问题。</li>
        <li>个人 Wiki 应该把碎片内容转化成稳定页面，而不是保存原文堆积。</li>
        <li>AI 的价值在于降低整理成本，同时保留用户确认权。</li>
      </ul>
      <h2>相关知识</h2>
      <p>[[个人知识管理]] [[AI 整理台]] [[个人 Wiki]]</p>
      <h2>待继续研究的问题</h2>
      <ul>
        <li>如何判断一条信息是否已经完成知识化？</li>
        <li>什么时候应该新建页面，什么时候应该补充已有页面？</li>
      </ul>
    `,
  },
  {
    id: "c2",
    title: "浏览器插件只做收集入口",
    source: "网页摘录",
    status: "未整理",
    type: "产品决策",
    action: "补充已有页面",
    links: 2,
    topics: ["浏览器插件", "收集箱", "产品边界"],
    summary:
      "这段内容适合补充到浏览器插件方案里。插件应保持轻量，只负责把网页内容送到收集箱，不承担复杂整理和编辑。",
    draft: `
      <h1>浏览器插件的边界</h1>
      <h2>一句话解释</h2>
      <p>知脉插件的第一职责是降低收集成本，而不是替代 Web 整理台。</p>
      <h2>核心观点</h2>
      <ul>
        <li>插件保存网页标题、URL、选中文本和用户备注。</li>
        <li>复杂的 AI 整理、草稿编辑和 Wiki 写入留在 Web 端完成。</li>
        <li>插件越轻，发布和稳定性越容易控制。</li>
      </ul>
      <h2>适用场景</h2>
      <p>用户在阅读网页、研究资料或竞品页面时，可以快速保存有价值片段，之后回到整理台统一处理。</p>
      <h2>相关知识</h2>
      <p>[[收集箱]] [[整理台]] [[Web 与浏览器插件产品方案]]</p>
    `,
  },
  {
    id: "c3",
    title: "整理台采用三栏布局",
    source: "产品笔记",
    status: "已分析",
    type: "方法",
    action: "创建新页面",
    links: 4,
    topics: ["整理台", "信息架构", "用户确认"],
    summary:
      "三栏布局可以同时呈现原始材料、AI 判断和 Wiki 草稿，让用户在确认时有足够上下文，适合知脉第一版核心界面。",
    draft: `
      <h1>整理台三栏布局</h1>
      <h2>一句话解释</h2>
      <p>整理台用三栏结构把原始内容、AI 判断和 Wiki 草稿放在同一个工作面上。</p>
      <h2>结构</h2>
      <ul>
        <li>左栏：原始输入，帮助用户核对来源。</li>
        <li>中栏：AI 判断，展示类型、主题、动作和关联建议。</li>
        <li>右栏：Wiki 草稿，用户可以直接修改并确认写入。</li>
      </ul>
      <h2>设计意图</h2>
      <p>知脉第一版应保护知识库质量，所以不能让 AI 直接自动写入。三栏布局把确认动作变得清晰，也减少用户来回切换。</p>
      <h2>相关知识</h2>
      <p>[[AI 知识重构流程]] [[用户确认]] [[Wiki 页面模板]]</p>
    `,
  },
];

const wikiPages = [
  {
    title: "知识管理的核心是重构认知结构",
    type: "观点",
    space: "知脉产品设计 / 核心理念",
    owner: "我",
    aiState: "已成文",
    iconType: "doc",
    tags: ["知识管理", "个人 Wiki"],
    updated: "今天 17:42",
    body: `
      <h1>知识管理的核心是重构认知结构</h1>
      <p>知识管理的价值不只是保存信息，而是帮助人持续更新自己的理解方式。</p>
      <h2>核心观点</h2>
      <ul>
        <li>保存信息只是第一步，知识化才是关键。</li>
        <li>稳定的 Wiki 页面比零散摘录更容易复用。</li>
        <li>AI 应该负责整理建议，用户负责最终判断。</li>
      </ul>
      <h2>来源材料</h2>
      <p>来自 3 条收集内容，最近一次更新来自 Web 输入。</p>
    `,
  },
  {
    title: "整理台三栏布局",
    type: "方法",
    space: "知脉产品设计 / 交互方案",
    owner: "我",
    aiState: "已关联",
    iconType: "method",
    tags: ["整理台", "产品设计"],
    updated: "今天 16:18",
    body: `
      <h1>整理台三栏布局</h1>
      <p>整理台用三栏结构把原始内容、AI 判断和 Wiki 草稿放在同一个工作面上。</p>
      <h2>适用场景</h2>
      <p>当用户需要判断 AI 是否正确理解材料时，三栏布局可以保留上下文并降低确认成本。</p>
    `,
  },
  {
    title: "浏览器插件的边界",
    type: "产品决策",
    space: "知脉产品设计 / 浏览器插件",
    owner: "我",
    aiState: "待补充",
    iconType: "case",
    tags: ["插件", "收集箱"],
    updated: "昨天 21:09",
    body: `
      <h1>浏览器插件的边界</h1>
      <p>知脉插件的第一职责是降低收集成本，而不是替代 Web 整理台。</p>
      <h2>不做什么</h2>
      <ul>
        <li>不做复杂页面编辑。</li>
        <li>不默认抓取全文。</li>
        <li>不承担知识库管理。</li>
      </ul>
    `,
  },
  {
    title: "收集箱状态设计",
    type: "方法",
    space: "知脉产品设计 / 收集箱",
    owner: "我",
    aiState: "已关联",
    iconType: "method",
    tags: ["收集箱", "状态流转"],
    updated: "昨天 18:26",
    body: `
      <h1>收集箱状态设计</h1>
      <p>收集箱需要区分未整理、已分析、待确认、已写入和已忽略，帮助用户快速处理积压内容。</p>
    `,
  },
  {
    title: "如何避免重复创建页面",
    type: "问题",
    space: "知脉产品设计 / AI 质量",
    owner: "我",
    aiState: "待研究",
    iconType: "question",
    tags: ["AI", "重复页面"],
    updated: "昨天 11:03",
    body: `
      <h1>如何避免重复创建页面</h1>
      <p>AI 写入 Wiki 前应先检索相似页面，并优先建议补充已有页面。</p>
    `,
  },
  {
    title: "Wiki 页面模板",
    type: "模板",
    space: "知脉个人知识库 / 模板",
    owner: "我",
    aiState: "可复用",
    iconType: "doc",
    tags: ["模板", "Wiki"],
    updated: "07-05 17:20",
    body: `
      <h1>Wiki 页面模板</h1>
      <p>标准页面包含一句话解释、背景、核心观点、详细说明、相关知识和待研究问题。</p>
    `,
  },
  {
    title: "个人知识库的导出策略",
    type: "决策",
    space: "知脉产品设计 / 数据结构",
    owner: "我",
    aiState: "已成文",
    iconType: "case",
    tags: ["Markdown", "导出"],
    updated: "07-05 16:48",
    body: `
      <h1>个人知识库的导出策略</h1>
      <p>即使第一版使用数据库，也应保证 Wiki 页面可以导出为 Markdown。</p>
    `,
  },
];

let selectedCaptureId = captures[0].id;
let selectedWikiIndex = 0;

const titles = {
  workspace: ["工作台", "把碎片内容整理成结构化、可关联、可复用的个人 Wiki。"],
  inbox: ["收集箱", "统一管理 Web、插件和手动输入的所有原始材料。"],
  wiki: ["知识库", "阅读、编辑和复用已经沉淀的 Wiki 页面。"],
  graph: ["脉图", "查看知识页面之间的主题关系和增长脉络。"],
  extension: ["浏览器插件", "在网页阅读时快速保存标题、链接、选中文本和个人理解。"],
};

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function renderCaptures() {
  const list = $("#captureList");
  list.innerHTML = captures
    .map(
      (item) => `
        <button class="capture-item ${item.id === selectedCaptureId ? "active" : ""}" data-capture-id="${item.id}">
          <h3>${item.title}</h3>
          <div class="item-meta">
            <span>${item.source}</span>
            <span>${item.status}</span>
          </div>
          <div class="tag-row">
            ${item.topics.slice(0, 2).map((topic) => `<span class="tag">${topic}</span>`).join("")}
          </div>
        </button>
      `,
    )
    .join("");

  $all("[data-capture-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCaptureId = button.dataset.captureId;
      renderCaptures();
      renderAnalysis();
    });
  });
}

function renderAnalysis() {
  const item = captures.find((capture) => capture.id === selectedCaptureId) || captures[0];
  $("#analysisType").textContent = item.type;
  $("#analysisAction").textContent = item.action;
  $("#analysisLinks").textContent = `${item.links} 个`;
  $("#analysisSummary").textContent = item.summary;
  $("#topicCloud").innerHTML = item.topics.map((topic) => `<span class="topic">${topic}</span>`).join("");
  $("#wikiDraft").innerHTML = item.draft;
  $("#analysisStatus").textContent = item.status === "未整理" ? "需确认" : "可写入";
}

function renderInbox() {
  $("#inboxTable").innerHTML = captures
    .map(
      (item) => `
        <div class="table-row">
          <strong>${item.title}</strong>
          <span>${item.source}</span>
          <span>${item.status}</span>
          <span>${item.action}</span>
        </div>
      `,
    )
    .join("");
}

function pagePath(page) {
  if (page.space?.includes("浏览器插件")) return "知脉产品设计 / 浏览器插件";
  if (page.space?.includes("AI 质量")) return "AI 资料库 / AI 质量";
  if (page.space?.includes("模板")) return "方法与模板 / 模板";
  if (page.space?.includes("收集箱")) return "个人 Wiki / 方法沉淀";
  if (page.space?.includes("产品设计")) return "知脉产品设计 / 产品方案";
  return "个人 Wiki / 知识管理";
}

function setWikiReader(index) {
  const page = wikiPages[index] || wikiPages[0];
  selectedWikiIndex = index;
  $("#readerBreadcrumb").textContent = pagePath(page);
  $("#readerTitle").textContent = page.title;
  $("#readerMeta").textContent = `${page.type} · ${page.aiState || "已整理"} · ${page.updated}`;
  $("#readerTags").innerHTML = page.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  $("#readerBody").innerHTML = page.body;

  $all("[data-page-index]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.pageIndex) === index);
  });
}

function renderWikiList() {
  const tree = $("#treeDocuments");
  if (!tree) return;

  tree.innerHTML = wikiPages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => pagePath(page).startsWith("知脉产品设计 / 产品方案"))
    .map(
      ({ page, index }) => `
        <button class="tree-doc" data-view="wiki" data-page-index="${index}">
          <span>▤</span>
          <span>${page.title}</span>
        </button>
      `,
    )
    .join("");

  $all("[data-page-index]").forEach((button) => {
    button.addEventListener("click", () => {
      switchView("wiki");
      $all(".nav-item, .tree-doc").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      setWikiReader(Number(button.dataset.pageIndex));
    });
  });

  setWikiReader(selectedWikiIndex);
}

function bindTreeToggles() {
  $all("[data-tree-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const key = button.dataset.treeToggle;
      const panel = document.querySelector(`[data-tree-panel="${key}"]`);
      if (!panel) return;

      panel.classList.toggle("collapsed");
      button.classList.toggle("expanded", !panel.classList.contains("collapsed"));

      const caret = button.querySelector(".tree-caret") || button.querySelector("span:first-child");
      if (caret) caret.textContent = panel.classList.contains("collapsed") ? "›" : "⌄";

      if (!button.classList.contains("tree-doc")) {
        event.stopPropagation();
      }
    });
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function switchView(viewName) {
  $all(".view").forEach((view) => view.classList.remove("active"));
  $(`#${viewName}View`).classList.add("active");

  const [title, subtitle] = titles[viewName];
  $("#viewTitle").textContent = title;
  $("#viewSubtitle").textContent = subtitle;
}

function addCaptureFromInput() {
  const input = $("#captureInput");
  const content = input.value.trim();

  if (!content) {
    showToast("先输入一段内容");
    input.focus();
    return;
  }

  const newCapture = {
    id: `c${Date.now()}`,
    title: content.length > 18 ? `${content.slice(0, 18)}...` : content,
    source: "手动输入",
    status: "已分析",
    type: "观点",
    action: "创建新页面",
    links: 2,
    topics: ["个人知识", "待整理", "新输入"],
    summary: "这段输入已经生成初步判断，建议先形成短 Wiki 草稿，再由用户确认是否写入知识库。",
    draft: `
      <h1>${content.length > 22 ? content.slice(0, 22) : content}</h1>
      <h2>一句话解释</h2>
      <p>${content}</p>
      <h2>核心观点</h2>
      <ul>
        <li>这条内容适合作为个人知识库中的一个新观点。</li>
        <li>后续可以补充背景、例子和相关页面。</li>
      </ul>
      <h2>相关知识</h2>
      <p>[[个人知识管理]] [[待整理想法]]</p>
    `,
  };

  captures.unshift(newCapture);
  selectedCaptureId = newCapture.id;
  input.value = "";
  renderCaptures();
  renderInbox();
  renderAnalysis();
  $("#pendingCount").textContent = captures.filter((item) => item.status !== "已写入").length;
  showToast("已生成整理草稿");
}

function acceptDraft() {
  const item = captures.find((capture) => capture.id === selectedCaptureId);
  if (!item) return;

  item.status = "已写入";
  wikiPages.push({
    title: item.title,
    type: item.type,
    space: "知脉产品设计 / 产品方案",
    owner: "我",
    aiState: "刚写入",
    iconType: item.type === "方法" ? "method" : "doc",
    tags: item.topics.slice(0, 2),
    updated: "刚刚",
    body: item.draft,
  });

  $("#wikiCount").textContent = wikiPages.length;
  $("#pendingCount").textContent = captures.filter((capture) => capture.status !== "已写入").length;
  renderCaptures();
  renderInbox();
  renderWikiList();
  showToast("已写入 Wiki");
}

function boot() {
  renderCaptures();
  renderAnalysis();
  renderInbox();
  renderWikiList();
  bindTreeToggles();

  $all(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      switchView(button.dataset.view);
      $all(".nav-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  $("#processInputBtn").addEventListener("click", addCaptureFromInput);
  $("#quickCaptureBtn").addEventListener("click", () => {
    switchView("workspace");
    $all(".nav-item").forEach((item) => item.classList.remove("active"));
    $all(".nav-item").find((item) => item.dataset.view === "workspace")?.classList.add("active");
    $("#captureInput").focus();
  });
  $("#acceptBtn").addEventListener("click", acceptDraft);
  $("#rewriteBtn").addEventListener("click", () => showToast("已重新生成一版草稿"));
  $("#newDocBtn").addEventListener("click", () => showToast("新建文档入口：后续接入 Wiki 编辑器"));
}

boot();
