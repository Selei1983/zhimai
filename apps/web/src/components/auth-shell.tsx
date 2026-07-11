"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ZhimaiApp } from "@/components/zhimai-app";
import { createInsForgeBrowserClient } from "@/lib/insforge/browser-client";
import type { AppUser, AiProviderConfig, Capture, GraphOverview, LibraryTree, WikiPage } from "@/lib/zhimai-data";

type InitialData = {
  wikiPages: WikiPage[];
  captures: Capture[];
  graph: GraphOverview;
  libraries: LibraryTree[];
  aiConfig: AiProviderConfig | null;
};

type StoredSession = {
  accessToken: string;
  user: AppUser;
};

const sessionKey = "zhimai.auth.session";

export function AuthShell({ initialData }: { initialData: InitialData }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [workspaceData, setWorkspaceData] = useState<InitialData | null>(null);
  const [dataError, setDataError] = useState("");
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStoredSession();
      setSession(stored);
      setIsBooting(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    let cancelled = false;

    fetch("/api/initial-data", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: InitialData; error?: string };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error || "读取个人知识空间失败");
        }
        if (!cancelled) {
          setWorkspaceData(payload.data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkspaceData(null);
          setDataError(error instanceof Error ? error.message : "读取个人知识空间失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  const user = session?.user ?? null;

  if (isBooting) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f7] text-[13px] text-[#747a76]">
        正在进入知脉
      </div>
    );
  }

  if (!session || !user) {
    return (
      <AuthView
        onSignedIn={(nextSession) => {
          setWorkspaceData(null);
          setDataError("");
          setSession(nextSession);
        }}
      />
    );
  }

  if (!workspaceData) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8f7] px-6 text-center text-[13px] text-[#747a76]">
        <div>
          <div>{dataError ? "个人空间加载失败" : "正在打开你的个人知识空间"}</div>
          {dataError && <div className="mt-2 max-w-md text-[#9b3333]">{dataError}</div>}
          {dataError && (
            <button
              className="mt-4 h-9 rounded-lg border border-[#dfe3e1] bg-white px-4 font-medium text-[#202322]"
              onClick={() => {
                localStorage.removeItem(sessionKey);
                setDataError("");
                setWorkspaceData(null);
                setSession(null);
              }}
            >
              重新登录
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ZhimaiApp
      accessToken={session.accessToken}
      currentUser={user}
      initialData={workspaceData || initialData}
      onSignOut={async () => {
        try {
          await createInsForgeBrowserClient(session.accessToken).auth.signOut();
        } catch {
          // Local sign-out should still complete even if the remote session is already gone.
        }
        localStorage.removeItem(sessionKey);
        setDataError("");
        setWorkspaceData(null);
        setSession(null);
      }}
    />
  );
}

function AuthView({ onSignedIn }: { onSignedIn: (session: StoredSession) => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const copy = useMemo(
    () =>
      mode === "sign-in"
        ? {
            title: "登录知脉",
            subtitle: "继续整理你的个人知识库。",
            action: "登录",
            switchText: "还没有账号？",
            switchAction: "注册",
          }
        : {
            title: "注册知脉",
            subtitle: "创建你的个人知识空间。",
            action: "注册并进入",
            switchText: "已经有账号？",
            switchAction: "登录",
          },
    [mode],
  );

  const submit = () => {
    setError("");
    startTransition(async () => {
      try {
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
          throw new Error("邮箱和密码不能为空");
        }

        if (cleanPassword.length < 6) {
          throw new Error("密码至少需要 6 位");
        }

        const client = createInsForgeBrowserClient();
        const result =
          mode === "sign-in"
            ? await client.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword })
            : await client.auth.signUp({
                email: cleanEmail,
                password: cleanPassword,
                name: name.trim() || cleanEmail.split("@")[0],
              });

        if (result.error) {
          throw new Error(result.error.message);
        }

        const data = result.data as { accessToken?: string; user?: Record<string, unknown> } | null;
        if (!data?.accessToken || !data.user) {
          throw new Error("认证成功但未返回完整登录态");
        }

        const session = {
          accessToken: data.accessToken,
          user: normalizeUser(data.user, cleanEmail, name),
        };

        localStorage.setItem(sessionKey, JSON.stringify(session));
        onSignedIn(session);
      } catch (err) {
        setError(getAuthError(err));
      }
    });
  };

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1fr)_420px] bg-[#f7f8f7] text-[#202322]">
      <section className="flex min-h-screen flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#16846f] font-bold text-white">知</span>
          <strong>知脉</strong>
        </div>
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold">把碎片知识整理成个人 Wiki</h1>
          <p className="mt-3 max-w-xl text-[14px] leading-7 text-[#747a76]">
            注册后进入你的个人空间。每个账号都有独立知识库，收集箱、Wiki 页面和 AI 配置互不混用。
          </p>
        </div>
        <div className="text-[12px] text-[#969d99]">知脉 Demo</div>
      </section>

      <section className="flex min-h-screen items-center border-l border-[#e5e8e6] bg-white px-8">
        <div className="w-full">
          <h2 className="text-xl font-semibold">{copy.title}</h2>
          <p className="mt-1 text-[13px] text-[#747a76]">{copy.subtitle}</p>

          <div className="mt-6 grid gap-4">
            {mode === "sign-up" && (
              <label className="grid gap-2 text-[13px]">
                <span className="font-medium">姓名</span>
                <input
                  className="h-10 rounded-lg border border-[#dfe3e1] px-3 outline-none focus:border-[#16846f]"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="你的名字"
                  value={name}
                />
              </label>
            )}

            <label className="grid gap-2 text-[13px]">
              <span className="font-medium">邮箱</span>
              <input
                className="h-10 rounded-lg border border-[#dfe3e1] px-3 outline-none focus:border-[#16846f]"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            <label className="grid gap-2 text-[13px]">
              <span className="font-medium">密码</span>
              <input
                className="h-10 rounded-lg border border-[#dfe3e1] px-3 outline-none focus:border-[#16846f]"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                type="password"
                value={password}
              />
            </label>

            {error && (
              <div className="rounded-lg border border-[#efd0d0] bg-[#fff2f2] px-3 py-2 text-[13px] text-[#9b3333]">
                {error}
              </div>
            )}

            <button
              className="h-10 rounded-lg bg-[#16846f] px-4 font-semibold text-white disabled:opacity-60"
              disabled={isPending}
              onClick={submit}
            >
              {isPending ? "处理中" : copy.action}
            </button>

            <div className="text-center text-[13px] text-[#747a76]">
              {copy.switchText}
              <button
                className="ml-1 font-semibold text-[#16846f]"
                onClick={() => {
                  setError("");
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                }}
              >
                {copy.switchAction}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session.accessToken || !session.user?.email) return null;
    return session;
  } catch {
    return null;
  }
}

function normalizeUser(rawUser: Record<string, unknown>, email: string, name: string): AppUser {
  const id = String(rawUser.id ?? rawUser.sub ?? email);
  const rawEmail = typeof rawUser.email === "string" ? rawUser.email : email;
  const rawName =
    typeof rawUser.name === "string"
      ? rawUser.name
      : typeof rawUser.displayName === "string"
        ? rawUser.displayName
        : name.trim() || rawEmail.split("@")[0];

  return {
    id,
    email: rawEmail,
    name: rawName,
  };
}

function getAuthError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "认证失败，请稍后再试";
}
