"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createCapture,
  createWikiPage,
  createWikiPageFromCapture,
  saveAiConfig,
  testAiConfig,
  updateWikiPage,
} from "@/app/actions";
import { defaultGenerationPrompt } from "@/lib/ai/defaults";
import { sourceTypeOptions } from "@/lib/captures/source-types";
import type {
  AiProviderConfig,
  AppUser,
  Capture,
  GraphOverview,
  KnowledgeSourceType,
  LibraryTree,
  PlanningRunSummary,
  TopicNodeSummary,
  WikiPage,
} from "@/lib/zhimai-data";

type View = "workspace" | "inbox" | "wiki" | "graph" | "extension" | "settings" | "profile";

type ZhimaiAppProps = {
  accessToken: string;
  currentUser: AppUser;
  initialData: {
    wikiPages: WikiPage[];
    captures: Capture[];
    graph: GraphOverview;
    libraries: LibraryTree[];
    aiConfig: AiProviderConfig | null;
  };
  onSignOut: () => void | Promise<void>;
};

const viewCopy: Record<View, { title: string; subtitle: string }> = {
  workspace: {
    title: "工作台",
    subtitle: "把碎片内容整理成结构化、可关联、可复用的个人 Wiki。",
  },
  inbox: {
    title: "收集箱",
    subtitle: "统一管理 Web、插件和手动输入的所有原始材料。",
  },
  wiki: {
    title: "知识库",
    subtitle: "左侧管理目录树，右侧阅读和编辑当前知识页面。",
  },
  graph: {
    title: "脉图",
    subtitle: "查看知识页面之间的主题关系和增长脉络。",
  },
  extension: {
    title: "浏览器插件",
    subtitle: "在网页阅读时快速保存标题、链接、选中文本和个人理解。",
  },
  settings: {
    title: "设置",
    subtitle: "配置 AI 服务、模型和个人 API Key。",
  },
  profile: {
    title: "个人中心",
    subtitle: "查看当前账号、空间和基础配置。",
  },
};

export function ZhimaiApp({ accessToken, currentUser, initialData, onSignOut }: ZhimaiAppProps) {
  const [captures, setCaptures] = useState(initialData.captures);
  const [graph, setGraph] = useState(initialData.graph);
  const [libraries, setLibraries] = useState(initialData.libraries);
  const [wikiPages, setWikiPages] = useState(initialData.wikiPages);
  const [aiConfig, setAiConfig] = useState(initialData.aiConfig);
  const [activeView, setActiveView] = useState<View>("workspace");
  const [activePageId, setActivePageId] = useState(wikiPages[0]?.id ?? "");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    "个人 Wiki": true,
    "个人 Wiki/知识管理": true,
    "知脉产品设计": true,
    "知脉产品设计/产品方案": true,
  });

  const activePage = useMemo(
    () => wikiPages.find((page) => page.id === activePageId) ?? wikiPages[0],
    [activePageId, wikiPages],
  );

  const selectPage = (page: WikiPage) => {
    setActivePageId(page.id);
    setActiveView("wiki");
  };

  const setActivePageIdAndOpen = (pageId: string) => {
    setActivePageId(pageId);
    setActiveView("wiki");
  };

  const toggleFolder = (key: string) => {
    setOpenFolders((current) => ({ ...current, [key]: !current[key] }));
  };

  const addLibraryFolderIfMissing = (libraryName: string, folderName: string) => {
    setLibraries((current) => {
      const library = current.find((item) => item.name === libraryName);
      if (!library) {
        return [...current, { name: libraryName, folders: [folderName] }];
      }

      if (library.folders.includes(folderName)) {
        return current;
      }

      return current.map((item) =>
        item.name === libraryName ? { ...item, folders: [...item.folders, folderName] } : item,
      );
    });
  };

  const runAction = (task: () => Promise<void>, successMessage?: string) => {
    setNotice(null);
    startTransition(async () => {
      try {
        await ensureSessionActive(accessToken);
        await task();
        if (successMessage) {
          setNotice({ tone: "success", message: successMessage });
        }
      } catch (error) {
        const message = getErrorMessage(error);
        setNotice({ tone: "error", message });
        if (isAuthErrorMessage(message)) {
          window.setTimeout(() => {
            void onSignOut();
          }, 600);
        }
      }
    });
  };

  const handleCreatePage = () => {
    const targetLibrary = activePage?.library ?? "个人 Wiki";
    const targetFolder = activePage?.folder ?? "知识管理";

    runAction(async () => {
      const page = await createWikiPage(
        {
          title: "未命名页面",
          libraryName: targetLibrary,
          folderName: targetFolder,
        },
        accessToken,
      );

      addLibraryFolderIfMissing(page.library, page.folder);
      setWikiPages((current) => [page, ...current]);
      setOpenFolders((current) => ({
        ...current,
        [page.library]: true,
        [`${page.library}/${page.folder}`]: true,
      }));
      setActivePageId(page.id);
      setActiveView("wiki");
    }, "已新建 Wiki 页面");
  };

  const handleSavePage = (input: { id: string; title: string; contentMarkdown: string }) => {
    runAction(async () => {
      const page = await updateWikiPage(input, accessToken);
      setWikiPages((current) => current.map((item) => (item.id === page.id ? page : item)));
      setActivePageId(page.id);
    }, "已保存页面");
  };

  const handleCreateCapture = (input: { rawContent: string; sourceTitle?: string; sourceType: KnowledgeSourceType }) => {
    runAction(async () => {
      const capture = await createCapture(input, accessToken);
      setCaptures((current) => [capture, ...current]);
    }, "已保存到收集箱");
  };

  const handleCreatePageFromCapture = (captureId: string) => {
    runAction(async () => {
      const result = await createWikiPageFromCapture({ captureId }, accessToken);
      addLibraryFolderIfMissing(result.page.library, result.page.folder);
      setCaptures((current) =>
        current.map((capture) => (capture.id === result.capture.id ? result.capture : capture)),
      );
      setWikiPages((current) => upsertWikiPage(current, result.page));
      const graphUpdate = result.graph;
      if (graphUpdate) {
        setGraph((current) => mergeGraphOverview(current, graphUpdate));
      }
      setOpenFolders((current) => ({
        ...current,
        [result.page.library]: true,
        [`${result.page.library}/${result.page.folder}`]: true,
      }));
      setActivePageId(result.page.id);
      setActiveView("wiki");
      setNotice({
        tone: "success",
        message: result.graph
          ? `已规划写入「${result.graph.planningRun.targetTitle}」：${actionLabel(result.graph.planningRun.action)}`
          : "已规划写入 Wiki",
      });
    });
  };

  const handleSaveAiConfig = (input: {
    provider: AiProviderConfig["provider"];
    baseUrl: string;
    model: string;
    generationPrompt?: string;
    apiKey?: string;
    isEnabled: boolean;
  }) => {
    runAction(async () => {
      const config = await saveAiConfig(input, accessToken);
      setAiConfig(config);
    }, "AI 配置已保存");
  };

  const handleTestAiConfig = async (input: {
    provider: AiProviderConfig["provider"];
    baseUrl: string;
    model: string;
    generationPrompt?: string;
    apiKey?: string;
    isEnabled: boolean;
  }) => {
    await ensureSessionActive(accessToken);
    return testAiConfig(input, accessToken);
  };

  const copy = viewCopy[activeView];

  return (
    <div className="grid min-h-screen grid-cols-[286px_minmax(0,1fr)] bg-[#f7f8f7] text-[#202322]">
      <aside className="flex h-screen flex-col border-r border-[#e5e8e6] bg-[#f5f6f5]">
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#16846f] font-bold text-white">
                知
              </span>
              <span className="font-bold">知脉</span>
              <span className="text-[#747a76]">⌄</span>
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-lg text-[#747a76]">◖</button>
          </div>

          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_42px] gap-2">
            <button className="grid min-h-10 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#ecefed] px-3 text-left text-[#969d99]">
              <span>⌕</span>
              <span>搜索</span>
              <kbd className="text-xs">⌘ J</kbd>
            </button>
            <button
              className="grid h-10 place-items-center rounded-lg border border-[#e5e8e6] bg-white text-xl"
              onClick={handleCreatePage}
            >
              ＋
            </button>
          </div>

          <nav className="mb-7 grid gap-1">
            <SidebarNavItem active={activeView === "workspace"} onClick={() => setActiveView("workspace")}>
              工作台
            </SidebarNavItem>
            <SidebarNavItem active={activeView === "inbox"} onClick={() => setActiveView("inbox")}>
              收集箱
            </SidebarNavItem>
            <SidebarNavItem active={activeView === "wiki"} onClick={() => setActiveView("wiki")}>
              知识库
            </SidebarNavItem>
            <SidebarNavItem active={activeView === "graph"} onClick={() => setActiveView("graph")}>
              脉图
            </SidebarNavItem>
            <SidebarNavItem active={activeView === "extension"} onClick={() => setActiveView("extension")}>
              插件
            </SidebarNavItem>
          </nav>

          <section className="grid gap-1">
            <button className="grid min-h-8 grid-cols-[18px_minmax(0,1fr)_18px] items-center gap-1 px-2 text-left text-[14px] text-[#747a76]">
              <span>⌄</span>
              <strong className="text-[#444844]">知识库</strong>
              <span>›</span>
            </button>

            {libraries.map((library) => {
              const libraryOpen = Boolean(openFolders[library.name]);
              return (
                <div key={library.name}>
                  <button
                    className="grid min-h-9 w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 text-left text-[14px] text-[#747a76] hover:bg-[#e9ecea]"
                    onClick={() => toggleFolder(library.name)}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-[#ecefed] text-xs">▤</span>
                    <span className="truncate font-semibold text-[#3f4541]">{library.name}</span>
                    <span>{libraryOpen ? "⌄" : "›"}</span>
                  </button>

                  {libraryOpen && (
                    <div className="ml-8 grid gap-1">
                      {library.folders.map((folder) => {
                        const folderKey = `${library.name}/${folder}`;
                        const folderOpen = Boolean(openFolders[folderKey]);
                        const pages = wikiPages.filter(
                          (page) => page.library === library.name && page.folder === folder,
                        );

                        return (
                          <div key={folderKey}>
                            <button
                              className="grid min-h-8 w-full grid-cols-[18px_minmax(0,1fr)] items-center rounded-lg pr-2 text-left text-[14px] text-[#747a76] hover:bg-[#e9ecea]"
                              onClick={() => toggleFolder(folderKey)}
                            >
                              <span>{folderOpen ? "⌄" : "›"}</span>
                              <strong className="truncate text-[14px] font-semibold text-[#555a54]">{folder}</strong>
                            </button>

                            {folderOpen && (
                              <div className="ml-4 grid gap-1">
                                {pages.map((page) => (
                                  <button
                                    key={page.id}
                                    className={`grid min-h-7 w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-1 rounded-lg px-2 text-left text-[13px] ${
                                      page.id === activePageId && activeView === "wiki"
                                        ? "bg-[#e9ecea] text-[#202322]"
                                        : "text-[#747a76] hover:bg-[#e9ecea]"
                                    }`}
                                    onClick={() => selectPage(page)}
                                  >
                                    <span>▤</span>
                                    <span className="truncate">{page.title}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <AccountPanel
          aiConfig={aiConfig}
          currentUser={currentUser}
          pendingCount={captures.filter((item) => item.status !== "已写入").length}
          onOpenProfile={() => setActiveView("profile")}
          onOpenSettings={() => setActiveView("settings")}
          onSignOut={onSignOut}
        />
      </aside>

      <main className="min-w-0 p-6">
        <header className="mb-5 flex items-start justify-between gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">{copy.title}</h1>
            <p className="mt-1 text-[13px] leading-5 text-[#747a76]">{copy.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e8e6] bg-white">⌕</button>
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e8e6] bg-white">⇄</button>
            <button
              className="h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white"
              onClick={() => setActiveView("workspace")}
            >
              快速收集
            </button>
          </div>
        </header>

        {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}

        {activeView === "workspace" && (
          <WorkspaceView
            captures={captures}
            isSaving={isPending}
            onCreateCapture={handleCreateCapture}
          />
        )}
        {activeView === "inbox" && (
          <InboxView
            captures={captures}
            isSaving={isPending}
            onCreatePageFromCapture={handleCreatePageFromCapture}
          />
        )}
        {activeView === "wiki" &&
          (activePage ? (
            <WikiReader
              key={activePage.id}
              isSaving={isPending}
              onCreate={handleCreatePage}
              onSave={handleSavePage}
              page={activePage}
            />
          ) : (
            <EmptyWikiView onCreate={handleCreatePage} />
          ))}
        {activeView === "graph" && <GraphView graph={graph} onOpenPage={setActivePageIdAndOpen} wikiPages={wikiPages} />}
        {activeView === "extension" && <ExtensionView />}
        {activeView === "settings" && (
          <AiSettingsView
            config={aiConfig}
            isSaving={isPending}
            onSave={handleSaveAiConfig}
            onTest={handleTestAiConfig}
          />
        )}
        {activeView === "profile" && (
          <ProfileView
            aiConfig={aiConfig}
            currentUser={currentUser}
            onOpenSettings={() => setActiveView("settings")}
            onSignOut={onSignOut}
          />
        )}
      </main>
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "success" | "error" }) {
  return (
    <div
      className={`mb-4 rounded-lg border px-3 py-2 text-[13px] ${
        tone === "success"
          ? "border-[#cfe4db] bg-[#eef7f3] text-[#236251]"
          : "border-[#efd0d0] bg-[#fff2f2] text-[#9b3333]"
      }`}
    >
      {children}
    </div>
  );
}

function upsertWikiPage(pages: WikiPage[], page: WikiPage) {
  const exists = pages.some((item) => item.id === page.id);
  if (!exists) return [page, ...pages];
  return pages.map((item) => (item.id === page.id ? page : item));
}

function mergeGraphOverview(
  current: GraphOverview,
  update: { planningRun: PlanningRunSummary; topic: TopicNodeSummary },
): GraphOverview {
  const existingTopic = current.topics.find((topic) => topic.id === update.topic.id);
  const topics = existingTopic
    ? current.topics.map((topic) =>
        topic.id === update.topic.id
          ? {
              ...topic,
              ...update.topic,
              atomCount: topic.atomCount + update.topic.atomCount,
            }
          : topic,
      )
    : [update.topic, ...current.topics];

  return {
    atomCount: current.atomCount + update.topic.atomCount,
    recentPlanningRuns: [update.planningRun, ...current.recentPlanningRuns].slice(0, 8),
    topics,
  };
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    update_existing_topic: "更新已有主题",
    create_new_topic: "新建主题",
    create_subtopic: "创建子主题",
    merge_with_topic: "合并主题",
    split_into_multiple_topics: "拆分主题",
    append_as_evidence: "补充为证据",
    archive_as_source_only: "仅归档来源",
    hold_for_more_sources: "等待更多材料",
  };
  return labels[action] ?? "完成规划";
}

function SidebarNavItem({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-left text-[14px] ${
        active ? "bg-[#e9ecea] text-[#202322]" : "text-[#747a76] hover:bg-[#e9ecea]"
      }`}
      onClick={onClick}
    >
      <span className="w-6 text-center text-[#747a76]">●</span>
      <span>{children}</span>
    </button>
  );
}

function AccountPanel({
  aiConfig,
  currentUser,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  pendingCount,
}: {
  aiConfig: AiProviderConfig | null;
  currentUser: AppUser;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  pendingCount: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const membershipLabel = "Free";

  const openProfile = () => {
    setMenuOpen(false);
    onOpenProfile();
  };

  const openSettings = () => {
    setMenuOpen(false);
    onOpenSettings();
  };

  const signOut = () => {
    setMenuOpen(false);
    onSignOut();
  };

  return (
    <div className="relative border-t border-[#e5e8e6] bg-[#f5f6f5] px-3.5 py-3">
      {menuOpen && (
        <div className="absolute bottom-[76px] right-3 z-20 w-32 overflow-hidden rounded-lg border border-[#e1e5e2] bg-white py-1 text-[13px] shadow-[0_14px_36px_rgba(32,35,34,0.12)]">
          <button className="block h-9 w-full px-3 text-left text-[#555a54] hover:bg-[#f4f5f4]" onClick={openProfile}>
            账户
          </button>
          <button className="block h-9 w-full px-3 text-left text-[#555a54] hover:bg-[#f4f5f4]" onClick={openSettings}>
            配置
          </button>
          <div className="my-1 border-t border-[#edf0ee]" />
          <button className="block h-9 w-full px-3 text-left text-[#9b3333] hover:bg-[#f7eeee]" onClick={signOut}>
            退出
          </button>
        </div>
      )}

      <div className="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-2">
        <button className="grid h-8 w-8 place-items-center rounded-lg bg-[#16846f] text-[13px] font-semibold text-white" onClick={openProfile}>
          {currentUser.name?.slice(0, 1) || currentUser.email.slice(0, 1).toUpperCase()}
        </button>

        <button
          className="min-w-0 rounded-lg px-1.5 py-1 text-left hover:bg-[#e9ecea]"
          onClick={openProfile}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-[#202322]">{currentUser.name || "知脉用户"}</span>
            <span
              className="inline-grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[#eef1ef] px-1 text-[10px] font-semibold text-[#747a76]"
              title={`${membershipLabel} 会员`}
            >
              ◇
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[#747a76]">
            {pendingCount} 条待整理 · AI {aiConfig?.isEnabled ? aiConfig.model : "未启用"}
          </span>
        </button>

        <button
          className={`grid h-8 w-8 place-items-center rounded-lg text-[16px] text-[#747a76] hover:bg-[#e9ecea] ${
            menuOpen ? "bg-[#e9ecea] text-[#202322]" : ""
          }`}
          aria-label="账户操作"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}

function WorkspaceView({
  captures,
  isSaving,
  onCreateCapture,
}: {
  captures: Capture[];
  isSaving: boolean;
  onCreateCapture: (input: { rawContent: string; sourceTitle?: string; sourceType: KnowledgeSourceType }) => void;
}) {
  const [rawContent, setRawContent] = useState("");
  const [sourceTitle, setSourceTitle] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("text");
  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");
  const selectedSource = sourceTypeOptions.find((option) => option.value === sourceType) ?? sourceTypeOptions[0];

  const handleSubmit = () => {
    if (!rawContent.trim()) return;
    onCreateCapture({ rawContent, sourceTitle, sourceType });
    setRawContent("");
    setSourceTitle(undefined);
    setFileName("");
    setFileError("");
  };

  const handleFileChange = async (file: File | undefined) => {
    setFileError("");
    setFileName("");
    setSourceTitle(undefined);
    setRawContent("");

    if (!file) return;

    setFileName(file.name);
    setSourceTitle(file.name);

    const metadata = [
      `文件名：${file.name}`,
      `文件类型：${file.type || "未知"}`,
      `文件大小：${formatFileSize(file.size)}`,
    ];

    try {
      if (isTextLikeFile(file)) {
        const text = await file.text();
        setRawContent([...metadata, "", "## 文件内容", text.slice(0, 8000)].join("\n"));
        if (text.length > 8000) {
          setFileError("文件内容较长，当前先截取前 8000 字进入收集箱。");
        }
        return;
      }

      setRawContent(
        [
          ...metadata,
          "",
          "## 待解析",
          "这个文件已记录为上传来源。后续接入文件存储与解析服务后，会抽取正文、章节、表格或图片内容。",
        ].join("\n"),
      );
    } catch {
      setFileError("读取文件失败，请换一个文件再试。");
    }
  };

  return (
    <div className="grid grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.2fr)] gap-4">
      <section className="rounded-lg border border-[#e5e8e6] bg-white p-4 shadow-[0_10px_28px_rgba(30,36,34,0.06)]">
        <div className="mb-3">
          <h2 className="font-semibold">快速输入</h2>
          <p className="mt-1 text-[13px] text-[#747a76]">选择来源类型后，知脉会进入对应的解析流程。</p>
        </div>
        <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-[#f1f3f2] p-1 text-[12px]">
          {sourceTypeOptions.map((option) => (
            <button
              key={option.value}
              className={`h-8 rounded-md font-medium ${
                sourceType === option.value ? "bg-white text-[#202322] shadow-sm" : "text-[#747a76] hover:bg-white/70"
              }`}
              onClick={() => {
                setSourceType(option.value);
                setFileError("");
                setFileName("");
                setSourceTitle(undefined);
                setRawContent("");
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {sourceType === "file" ? (
          <div className="rounded-lg border border-dashed border-[#cfd6d2] bg-[#fafbfa] p-4">
            <label className="grid cursor-pointer place-items-center gap-2 rounded-lg bg-white px-4 py-6 text-center text-[13px] hover:bg-[#f5f6f5]">
              <span className="font-semibold text-[#202322]">{fileName || "上传文件"}</span>
              <span className="text-[#747a76]">支持文本类文件直接读取；PDF、Word、图片会先记录文件信息。</span>
              <input
                className="hidden"
                onChange={(event) => void handleFileChange(event.target.files?.[0])}
                type="file"
              />
            </label>
            {rawContent && (
              <textarea
                className="mt-3 min-h-28 w-full resize-y rounded-lg border border-[#e5e8e6] bg-white p-3 text-[13px] outline-none focus:border-[#16846f]"
                onChange={(event) => setRawContent(event.target.value)}
                value={rawContent}
              />
            )}
          </div>
        ) : (
          <textarea
            className="min-h-32 w-full resize-y rounded-lg border border-[#e5e8e6] bg-white p-3 outline-none focus:border-[#16846f]"
            onChange={(event) => setRawContent(event.target.value)}
            placeholder={selectedSource.placeholder}
            value={rawContent}
          />
        )}
        <div className="mt-2 text-[12px] text-[#747a76]">解析方式：{selectedSource.parser}</div>
        {fileError && <div className="mt-2 text-[12px] text-[#9b6b1f]">{fileError}</div>}
        <button
          className="mt-3 h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white disabled:opacity-60"
          disabled={isSaving || !rawContent.trim()}
          onClick={handleSubmit}
        >
          {isSaving ? "保存中" : "保存到收集箱"}
        </button>
      </section>

      <section className="rounded-lg border border-[#e5e8e6] bg-white p-4 shadow-[0_10px_28px_rgba(30,36,34,0.06)]">
        <h2 className="mb-3 font-semibold">待整理</h2>
        <div className="grid gap-2">
          {captures.map((capture) => (
            <div key={capture.id} className="rounded-lg border border-[#e5e8e6] p-3">
              <div className="font-medium">{capture.title}</div>
              <div className="mt-2 flex justify-between text-[12px] text-[#747a76]">
                <span>{capture.source}</span>
                <span>{capture.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InboxView({
  captures,
  isSaving,
  onCreatePageFromCapture,
}: {
  captures: Capture[];
  isSaving: boolean;
  onCreatePageFromCapture: (captureId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Capture["status"] | "全部">("全部");
  const filteredCaptures = useMemo(
    () =>
      captures.filter((capture) => {
        const matchesQuery = capture.title.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus = status === "全部" || capture.status === status;
        return matchesQuery && matchesStatus;
      }),
    [captures, query, status],
  );

  return (
    <section className="rounded-lg border border-[#e5e8e6] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">收集箱</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="h-9 w-56 rounded-lg border border-[#e5e8e6] px-3 text-[13px] outline-none focus:border-[#16846f]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索收集内容"
            value={query}
          />
          <select
            className="h-9 rounded-lg border border-[#e5e8e6] bg-white px-3 text-[13px] outline-none focus:border-[#16846f]"
            onChange={(event) => setStatus(event.target.value as Capture["status"] | "全部")}
            value={status}
          >
            <option>全部</option>
            <option>未整理</option>
            <option>已分析</option>
            <option>待确认</option>
            <option>已写入</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        {filteredCaptures.map((capture) => (
          <div key={capture.id} className="grid grid-cols-[minmax(220px,1fr)_90px_120px_100px_120px_100px] items-center gap-3 rounded-lg border border-[#e5e8e6] p-3 text-[13px]">
            <strong>{capture.title}</strong>
            <span className="text-[#747a76]">{capture.source}</span>
            <span className="text-[#747a76]">{capture.parser}</span>
            <span className="text-[#747a76]">{capture.status}</span>
            <span className="text-[#747a76]">{capture.suggestedAction}</span>
            <button
              className="h-8 rounded-lg border border-[#e5e8e6] bg-white px-3 font-medium disabled:opacity-50"
              disabled={isSaving || capture.status === "已写入"}
              onClick={() => onCreatePageFromCapture(capture.id)}
            >
              {capture.status === "已写入" ? "已写入" : "规划写入"}
            </button>
          </div>
        ))}
        {filteredCaptures.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#dfe3e1] p-6 text-center text-[13px] text-[#747a76]">
            没有匹配的收集内容
          </div>
        )}
      </div>
    </section>
  );
}

function isTextLikeFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    ["md", "markdown", "txt", "csv", "json", "xml", "html", "css", "js", "ts", "tsx", "jsx", "log"].includes(
      extension || "",
    )
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function WikiReader({
  isSaving,
  onCreate,
  onSave,
  page,
}: {
  isSaving: boolean;
  onCreate: () => void;
  onSave: (input: { id: string; title: string; contentMarkdown: string }) => void;
  page: WikiPage;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [contentMarkdown, setContentMarkdown] = useState(page.content.join("\n\n"));

  const handleSave = () => {
    onSave({
      id: page.id,
      title,
      contentMarkdown,
    });
    setIsEditing(false);
  };

  return (
    <article className="min-h-[calc(100vh-148px)] max-w-4xl rounded-lg border border-[#e5e8e6] bg-white px-12 py-10 shadow-[0_10px_28px_rgba(30,36,34,0.06)]">
      <header className="border-b border-[#e5e8e6] pb-6">
        <div className="mb-2 text-[13px] text-[#747a76]">
          {page.library} / {page.folder}
        </div>
        <div className="flex items-start justify-between gap-5">
          <div>
            {isEditing ? (
              <input
                className="w-full rounded-lg border border-[#e5e8e6] px-3 py-2 text-2xl font-semibold leading-tight outline-none focus:border-[#16846f]"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            ) : (
              <h2 className="text-2xl font-semibold leading-tight">{page.title}</h2>
            )}
            <p className="mt-2 text-[13px] text-[#747a76]">
              {page.type} · {page.aiState} · {page.updatedAt}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              className="h-9 rounded-lg border border-[#e5e8e6] bg-white px-4 font-semibold"
              onClick={onCreate}
            >
              新建
            </button>
            {isEditing ? (
              <button
                className="h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white disabled:opacity-60"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving ? "保存中" : "保存"}
              </button>
            ) : (
              <button
                className="h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white"
                onClick={() => setIsEditing(true)}
              >
                编辑
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="mt-5 flex flex-wrap gap-2">
        {page.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#f1f3f2] px-2.5 py-1 text-xs text-[#747a76]">
            {tag}
          </span>
        ))}
      </div>
      {isEditing ? (
        <textarea
          className="mt-6 min-h-[360px] w-full resize-y rounded-lg border border-[#e5e8e6] p-4 text-[14px] leading-7 outline-none focus:border-[#16846f]"
          onChange={(event) => setContentMarkdown(event.target.value)}
          value={contentMarkdown}
        />
      ) : (
        <div className="mt-6 space-y-4 text-[15px] leading-7 text-[#202322]">
          {page.content.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      )}
    </article>
  );
}

function EmptyWikiView({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-lg border border-[#e5e8e6] bg-white p-8">
      <h2 className="text-lg font-semibold">还没有 Wiki 页面</h2>
      <p className="mt-2 text-[#747a76]">创建第一篇页面后，它会出现在左侧知识库目录里。</p>
      <button className="mt-4 h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white" onClick={onCreate}>
        新建页面
      </button>
    </section>
  );
}

function GraphView({
  graph,
  onOpenPage,
  wikiPages,
}: {
  graph: GraphOverview;
  onOpenPage: (pageId: string) => void;
  wikiPages: WikiPage[];
}) {
  const linkedTopicCount = graph.topics.filter((topic) => topic.pageId).length;
  const latestRuns = graph.recentPlanningRuns;

  return (
    <div className="grid max-w-6xl gap-4">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricBlock label="主题节点" value={graph.topics.length} />
        <MetricBlock label="知识原子" value={graph.atomCount} />
        <MetricBlock label="已关联页面" value={linkedTopicCount} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-lg border border-[#e5e8e6] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">主题结构</h2>
            <span className="text-[12px] text-[#747a76]">按最近更新排序</span>
          </div>
          <div className="grid gap-2">
            {graph.topics.map((topic) => {
              const page = topic.pageId ? wikiPages.find((item) => item.id === topic.pageId) : undefined;
              return (
                <div
                  key={topic.id}
                  className="grid gap-2 rounded-lg border border-[#e5e8e6] px-3 py-3 md:grid-cols-[minmax(0,1fr)_120px_92px]"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-[14px]">{topic.name}</strong>
                      <span className="rounded-md bg-[#f1f3f2] px-1.5 py-0.5 text-[11px] text-[#747a76]">
                        {levelLabel(topic.level)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#747a76]">{topic.summary}</p>
                    <div className="mt-2 text-[12px] text-[#8a908c]">
                      {topic.atomCount} 个知识原子 · {topic.updatedAt}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#747a76]">
                    <div className="font-medium text-[#555a54]">页面</div>
                    <div className="mt-1 truncate">{page?.title ?? "未关联"}</div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      className="h-8 rounded-lg border border-[#e5e8e6] bg-white px-3 text-[12px] font-medium disabled:opacity-45"
                      disabled={!topic.pageId}
                      onClick={() => topic.pageId && onOpenPage(topic.pageId)}
                    >
                      打开
                    </button>
                  </div>
                </div>
              );
            })}
            {graph.topics.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#dfe3e1] p-6 text-center text-[13px] text-[#747a76]">
                还没有主题节点。先在收集箱点击“规划写入”，这里会出现类目与主题沉淀。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#e5e8e6] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">最近规划</h2>
            <span className="text-[12px] text-[#747a76]">{latestRuns.length} 条</span>
          </div>
          <div className="grid gap-2">
            {latestRuns.map((run) => (
              <div key={run.id} className="rounded-lg border border-[#e5e8e6] p-3">
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-[13px]">{run.targetTitle}</strong>
                  <span className="shrink-0 rounded-md bg-[#f1f3f2] px-1.5 py-0.5 text-[11px] text-[#747a76]">
                    {actionLabel(run.action)}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-[#747a76]">{run.reason}</p>
                <div className="mt-2 flex justify-between text-[12px] text-[#8a908c]">
                  <span>{run.atomCount} 个原子</span>
                  <span>{run.createdAt}</span>
                </div>
              </div>
            ))}
            {latestRuns.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#dfe3e1] p-6 text-center text-[13px] text-[#747a76]">
                暂无规划记录
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e5e8e6] bg-white p-4">
      <div className="text-[12px] text-[#747a76]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function levelLabel(level: string) {
  const labels: Record<string, string> = {
    aspect: "切面",
    domain: "领域",
    subtopic: "子主题",
    topic: "主题",
  };
  return labels[level] ?? level;
}

function ExtensionView() {
  const steps = [
    "打开 Chrome 扩展管理页",
    "开启开发者模式",
    "加载 apps/extension 文件夹",
    "在网页中选中文本后点击知脉图标保存",
  ];

  return (
    <section className="grid max-w-5xl gap-4">
      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <h2 className="font-semibold">插件入口</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#747a76]">
          当前插件会读取网页标题、链接、选中文本和备注，并写入 Web 收集箱。第一版只做收集，不在网页内做复杂编辑。
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <InfoLine label="接口" value="POST /api/captures" />
          <InfoLine label="本地地址" value="http://localhost:3001" />
          <InfoLine label="保存内容" value="标题、链接、选中文本、备注" />
          <InfoLine label="后续处理" value="进入收集箱后再成文" />
        </div>
      </div>

      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <h2 className="font-semibold">本地加载</h2>
        <div className="mt-4 grid gap-2">
          {steps.map((step, index) => (
            <div key={step} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 text-[13px]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f1f3f2] text-[#555a54]">
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const providerOptions: Array<{ label: string; value: AiProviderConfig["provider"]; baseUrl: string; model: string }> = [
  {
    label: "OpenAI Compatible",
    value: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    label: "OpenAI",
    value: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    label: "DeepSeek",
    value: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  {
    label: "Moonshot",
    value: "moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
  {
    label: "通义千问",
    value: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  {
    label: "自定义",
    value: "custom",
    baseUrl: "",
    model: "",
  },
];

function AiSettingsView({
  config,
  isSaving,
  onSave,
  onTest,
}: {
  config: AiProviderConfig | null;
  isSaving: boolean;
  onSave: (input: {
    provider: AiProviderConfig["provider"];
    baseUrl: string;
    model: string;
    generationPrompt?: string;
    apiKey?: string;
    isEnabled: boolean;
  }) => void;
  onTest: (input: {
    provider: AiProviderConfig["provider"];
    baseUrl: string;
    model: string;
    generationPrompt?: string;
    apiKey?: string;
    isEnabled: boolean;
  }) => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
}) {
  const currentProvider = config?.provider ?? "openai-compatible";
  const currentDefaults = providerOptions.find((option) => option.value === currentProvider) ?? providerOptions[0];
  const [provider, setProvider] = useState<AiProviderConfig["provider"]>(currentProvider);
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? currentDefaults.baseUrl);
  const [model, setModel] = useState(config?.model ?? currentDefaults.model);
  const [generationPrompt, setGenerationPrompt] = useState(config?.generationPrompt ?? defaultGenerationPrompt);
  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);

  const handleProviderChange = (value: AiProviderConfig["provider"]) => {
    const next = providerOptions.find((option) => option.value === value);
    setProvider(value);
    if (next && value !== "custom") {
      setBaseUrl(next.baseUrl);
      setModel(next.model);
    }
  };

  const handleSave = () => {
    onSave({
      provider,
      baseUrl,
      model,
      generationPrompt,
      apiKey: apiKey.trim() || undefined,
      isEnabled,
    });
    setApiKey("");
  };

  const getPayload = () => ({
    provider,
    baseUrl,
    model,
    generationPrompt,
    apiKey: apiKey.trim() || undefined,
    isEnabled,
  });

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(getPayload());
      setTestResult(result);
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : "测试连接失败",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="grid max-w-5xl gap-4">
      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">AI 服务配置</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#747a76]">
              知脉会使用你自己的模型服务完成内容分析、整理建议和 Wiki 草稿生成。API Key 只在服务端加密保存，页面不会再次显示完整 Key。
            </p>
          </div>
          <div className="rounded-lg border border-[#e5e8e6] px-3 py-2 text-[13px]">
            <span className="text-[#747a76]">状态：</span>
            <strong className={config?.isEnabled ? "text-[#236251]" : "text-[#9b3333]"}>
              {config?.isEnabled ? "已启用" : "未启用"}
            </strong>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-[13px]">
            <span className="font-medium">供应商</span>
            <select
              className="h-10 rounded-lg border border-[#e5e8e6] bg-white px-3 outline-none focus:border-[#16846f]"
              onChange={(event) => handleProviderChange(event.target.value as AiProviderConfig["provider"])}
              value={provider}
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-[13px]">
            <span className="font-medium">Base URL</span>
            <input
              className="h-10 rounded-lg border border-[#e5e8e6] px-3 outline-none focus:border-[#16846f]"
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-[13px]">
              <span className="font-medium">模型名</span>
              <input
                className="h-10 rounded-lg border border-[#e5e8e6] px-3 outline-none focus:border-[#16846f]"
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4.1-mini"
                value={model}
              />
            </label>

            <label className="grid gap-2 text-[13px]">
              <span className="font-medium">API Key</span>
              <input
                className="h-10 rounded-lg border border-[#e5e8e6] px-3 outline-none focus:border-[#16846f]"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={config?.keyHint ? `已配置：${config.keyHint}，留空则不修改` : "首次配置需要填写"}
                type="password"
                value={apiKey}
              />
            </label>
          </div>

          <label className="flex min-h-10 items-center gap-2 text-[13px]">
            <input
              checked={isEnabled}
              className="h-4 w-4"
              onChange={(event) => setIsEnabled(event.target.checked)}
              type="checkbox"
            />
            启用此 AI 配置
          </label>

          <label className="grid gap-2 text-[13px]">
            <span className="flex items-center justify-between gap-3">
              <span className="font-medium">内容生成 Prompt</span>
              <button
                className="h-7 rounded-lg border border-[#dfe3e1] bg-white px-2.5 text-[12px] font-medium text-[#555a54]"
                onClick={() => setGenerationPrompt(defaultGenerationPrompt)}
                type="button"
              >
                恢复默认
              </button>
            </span>
            <textarea
              className="min-h-48 w-full resize-y rounded-lg border border-[#e5e8e6] p-3 text-[13px] leading-6 outline-none focus:border-[#16846f]"
              onChange={(event) => setGenerationPrompt(event.target.value)}
              placeholder="描述你希望知脉如何把碎片内容整理成 Wiki 页面。"
              value={generationPrompt}
            />
            <span className="text-[12px] leading-5 text-[#747a76]">
              这个 Prompt 会用于后续“收集箱成文”和整理台生成 Wiki 草稿。建议写清楚结构、语气、是否保留来源、如何处理不确定信息。
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e8e6] pt-4">
            <div className="text-[13px] text-[#747a76]">
              {config ? `上次更新：${config.updatedAt}，Key：${config.keyHint}` : "尚未配置 AI 服务"}
            </div>
            <button
              className="h-9 rounded-lg border border-[#dfe3e1] bg-white px-4 font-semibold text-[#202322] disabled:opacity-60"
              disabled={isSaving || isTesting}
              onClick={handleTest}
            >
              {isTesting ? "测试中" : "测试连接"}
            </button>
            <button
              className="h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white disabled:opacity-60"
              disabled={isSaving || isTesting}
              onClick={handleSave}
            >
              {isSaving ? "保存中" : "保存配置"}
            </button>
          </div>
          {testResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-[13px] ${
                testResult.ok
                  ? "border-[#cfe3db] bg-[#f0f8f5] text-[#236251]"
                  : "border-[#efd0d0] bg-[#fff2f2] text-[#9b3333]"
              }`}
            >
              {testResult.message}
              {typeof testResult.latencyMs === "number" ? ` · ${testResult.latencyMs}ms` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <h2 className="font-semibold">后续会使用 AI 的位置</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <InfoLine label="收集箱" value="分析内容类型与主题" />
          <InfoLine label="整理台" value="生成 Wiki 草稿和关联建议" />
          <InfoLine label="知识库" value="查重、补充和建立页面关系" />
        </div>
      </div>
    </section>
  );
}

function ProfileView({
  aiConfig,
  currentUser,
  onOpenSettings,
  onSignOut,
}: {
  aiConfig: AiProviderConfig | null;
  currentUser: AppUser;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <section className="grid max-w-5xl gap-4">
      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#16846f] text-lg font-semibold text-white">
              {currentUser.name?.slice(0, 1) || currentUser.email.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 className="font-semibold">{currentUser.name || "知脉用户"}</h2>
              <p className="mt-1 text-[13px] text-[#747a76]">{currentUser.email}</p>
            </div>
          </div>
          <button
            className="h-9 rounded-lg border border-[#e5e8e6] bg-white px-4 font-semibold"
            onClick={onSignOut}
          >
            退出登录
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <InfoLine label="账号 ID" value={currentUser.id} />
          <InfoLine label="当前空间" value="知脉个人空间" />
          <InfoLine label="数据后端" value="InsForge" />
        </div>
      </div>

      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">AI 配置</h2>
            <p className="mt-1 text-[13px] text-[#747a76]">
              {aiConfig
                ? `${aiConfig.model} · ${aiConfig.keyHint} · ${aiConfig.isEnabled ? "已启用" : "未启用"}`
                : "还没有配置 AI 服务"}
            </p>
          </div>
          <button
            className="h-9 rounded-lg bg-[#16846f] px-4 font-semibold text-white"
            onClick={onOpenSettings}
          >
            配置 AI
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#e5e8e6] bg-white p-5">
        <h2 className="font-semibold">下一步账号能力</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <InfoLine label="空间隔离" value="按用户创建 workspace" />
          <InfoLine label="插件授权" value="使用用户 token 保存网页" />
          <InfoLine label="账户资料" value="头像、昵称和偏好设置" />
        </div>
      </div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e5e8e6] p-3">
      <div className="text-[12px] text-[#747a76]">{label}</div>
      <div className="mt-1 break-words text-[13px] font-medium">{value}</div>
    </div>
  );
}

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-[#e5e8e6] bg-white p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-[#747a76]">{description}</p>
    </section>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Server Components render")) {
      return "登录状态可能已失效，请重新登录后再试";
    }
    return error.message;
  }
  if (typeof error === "string") return error;
  return "操作失败，请稍后再试";
}

async function ensureSessionActive(accessToken: string) {
  const response = await fetch("/api/initial-data", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok) return;

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(payload?.error || "登录状态已失效，请重新登录");
}

function isAuthErrorMessage(message: string) {
  return message.includes("登录") || message.includes("Invalid token") || message.includes("token");
}
