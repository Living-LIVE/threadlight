import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CirclePause,
  ExternalLink,
  Flame,
  LockKeyhole,
  MessageCircle,
  MessageSquareWarning,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  Settings2,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  cloneElement,
  createContext,
  type FormEvent,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ActivityFilter, activityFilterCount, filterActivity } from "./activity-filter.js";
import { canLaunchSelectedProvider } from "./launch-readiness.js";
import { modelAfterProviderChange } from "./provider-model.js";
import { resolveStartupRoute } from "./startup-route.js";
import { runYouTubeAction } from "./youtube-action.js";

export type DestinationKind = "discord" | "slack" | "youtube-comments" | "teams" | "twitch";
export type Mode = "shy" | "medium" | "high";
export type Provider = "openai" | "gemini" | "gloo" | "bonfire";

const participationModeLabels: Record<Mode, string> = {
  shy: "Prompted",
  medium: "Attentive",
  high: "Active",
};

export type Deployment = {
  id: string;
  kind: DestinationKind;
  name: string;
  state: "draft" | "running" | "paused" | "error";
  configured: boolean;
  discord?: {
    applicationIdConfigured: boolean;
    botTokenConfigured: boolean;
    guildIdConfigured: boolean;
    channelIdConfigured: boolean;
    participationMode: Mode;
    quietSeconds: number;
  };
  youtube?: {
    channelId?: string;
    channelName?: string;
    selectedVideos: Array<{ id: string; title: string; thumbnailUrl?: string }>;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    refreshTokenConfigured: boolean;
    replyMode: "review" | "selective" | "high-touch";
    pollSeconds: number;
    dailyReplyLimit: number;
    lastPollAt?: string;
    lastError?: string;
    lastSafetyAlert?: string;
    replyCount: number;
    drafts: Array<{
      id: string;
      authorName: string;
      commentText: string;
      replyText: string;
      status: "pending" | "posted" | "rejected" | "skipped" | "failed";
      error?: string;
    }>;
  };
};

export type ControlStatus = {
  youtubeCallbackUrl: string;
  youtubeOAuthConfigured: boolean;
  catalog: Array<{
    kind: DestinationKind;
    label: string;
    state: "available" | "planned" | "coming-soon";
  }>;
  configuration: {
    providers: {
      ai: { provider: Provider; model: string; configured: boolean };
      scripture: { provider: "ao" | "youversion"; bibleId: string; configured: boolean };
    };
    deployments: Deployment[];
  };
  runtime: {
    deployments: Array<
      | {
          id: string;
          state: Deployment["state"];
          ready: boolean;
          message?: string;
        }
      | undefined
    >;
  };
};

export type ControlPreview = {
  reply?: {
    message: string;
    passage?: {
      reference: string;
      translation: string;
      attribution: string;
    };
  };
  decision: { action: string; reason: string };
  trace: { aiProvider: string; scriptureProvider: string; totalMs: number };
};

type PublicLiveStatus = {
  generatedAt: string;
  discord: {
    configured: boolean;
    ready: boolean;
    state: string;
    name: string;
    participationMode?: Mode;
    participationLabel?: string;
    inviteUrl?: string;
    openUrl?: string;
    widgetUrl?: string;
    message?: string;
  };
  youtube: {
    configured: boolean;
    ready: boolean;
    state: string;
    name: string;
    channelName?: string;
    channelUrl?: string;
    replyMode?: "review" | "selective" | "high-touch";
    replyPolicy?: string;
    lastPollAt?: string;
    lastError?: string;
    lastSafetyAlert?: string;
    replyCount: number;
    dailyReplyLimit?: number;
    selectedVideos: Array<{ title: string; thumbnailUrl?: string; url: string }>;
    recentComments: Array<{
      authorName: string;
      commentText: string;
      replyText: string;
      status: "pending" | "posted" | "rejected" | "skipped" | "failed";
      videoTitle?: string;
      createdAt: string;
      resolvedAt?: string;
      error?: string;
    }>;
  };
  activity: Array<{
    id: string;
    createdAt: string;
    source: "discord" | "youtube";
    status: "observed" | "queued" | "responded" | "drafted" | "posted" | "skipped" | "error";
    actor?: string;
    input?: string;
    output?: string;
    reason?: string;
    reference?: string;
    provider?: string;
    durationMs?: number;
  }>;
};

const icons = {
  discord: MessageCircle,
  slack: MessageCircle,
  "youtube-comments": Video,
  teams: Users,
  twitch: Radio,
} as const;

const descriptions: Record<DestinationKind, string> = {
  discord: "Respond in a server, channel, or thread.",
  slack: "Bring care and reflection into a workspace.",
  "youtube-comments": "Respond to conversations below your videos.",
  teams: "Connect with conversations in Microsoft Teams.",
  twitch: "Support a live chat with thoughtful presence.",
};

const apiOrigin = (import.meta.env.VITE_THREADLIGHT_API_ORIGIN ?? "").replace(/\/$/, "");

type ControlRequest = <T>(url: string, init?: RequestInit) => Promise<T>;
type Screen = "home" | "choose" | "connect" | "launch" | "settings" | "access";

const ControlRequestContext = createContext<ControlRequest | undefined>(undefined);

class ControlAccessRequiredError extends Error {}

function youtubeHealth(youtube: NonNullable<Deployment["youtube"]>) {
  const pendingDrafts = youtube.drafts.filter((draft) => draft.status === "pending").length;
  const parts = [
    youtube.channelName ?? "YouTube channel",
    `${pendingDrafts} pending ${pendingDrafts === 1 ? "draft" : "drafts"}`,
    `${youtube.replyCount}/${youtube.dailyReplyLimit} replies today`,
  ];
  if (youtube.lastPollAt) parts.push(`Last poll ${new Date(youtube.lastPollAt).toLocaleString()}`);
  return parts.join(" · ");
}

async function request<T>(url: string, init?: RequestInit, controlAccessCode?: string): Promise<T> {
  const response = await fetch(`${apiOrigin}${url}`, {
    ...init,
    headers: {
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      ...(controlAccessCode ? { authorization: `Bearer ${controlAccessCode}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => undefined)) as
    | { error?: string; message?: string }
    | undefined;
  if (!response.ok) {
    if (response.status === 401 && body?.error === "control_access_required") {
      throw new ControlAccessRequiredError();
    }
    throw new Error(body?.message ?? "Threadlight could not save that change.");
  }
  return body as T;
}

function useControlRequest() {
  const request = useContext(ControlRequestContext);
  if (!request) throw new Error("Threadlight control is unavailable.");
  return request;
}

const publicDemoCatalog: ControlStatus["catalog"] = [
  { kind: "discord", label: "Discord", state: "available" },
  { kind: "slack", label: "Slack", state: "planned" },
  { kind: "youtube-comments", label: "YouTube Comments", state: "available" },
  { kind: "teams", label: "Microsoft Teams", state: "coming-soon" },
  { kind: "twitch", label: "Twitch", state: "coming-soon" },
];

const publicDemoVideos = [
  { id: "demo-video-1", title: "Making room for a quieter kind of hope" },
  { id: "demo-video-2", title: "When the workday asks too much" },
];

const publicPreviewScenarios = [
  {
    id: "grief",
    label: "Grief and loneliness",
    prompt: "I keep telling everyone I am okay, but the house feels impossibly empty.",
  },
  {
    id: "conflict",
    label: "Conflict and restraint",
    prompt: "I am frustrated and I do not want to send something I will regret.",
  },
  {
    id: "encouragement",
    label: "Encouragement and gratitude",
    prompt: "Today was the first time I shared my story without feeling ashamed.",
  },
  {
    id: "prayer",
    label: "Prayer and courage",
    prompt: "My appointment is tomorrow morning. Would you pray for peace and courage?",
  },
] as const;

const publicDemoDiscordServers = [{ id: "demo-live-tapestry", name: "Live Tapestry" }];
const publicDemoDiscordChannels = [
  { id: "demo-integrations", name: "integrations" },
  { id: "demo-prayer-room", name: "prayer-room" },
];
const publicDemoYouTubeChannels = [
  { id: "demo-channel", name: "Threadlight Demo Channel" },
  { id: "demo-stories", name: "Threadlight Stories" },
];

export function createPublicDemoStatus(): ControlStatus {
  const discord: Deployment = {
    id: "demo-discord",
    kind: "discord",
    name: "Live Tapestry",
    state: "running",
    configured: true,
    discord: {
      applicationIdConfigured: true,
      botTokenConfigured: true,
      guildIdConfigured: true,
      channelIdConfigured: true,
      participationMode: "shy",
      quietSeconds: 20,
    },
  };
  return withPublicDemoRuntime({
    youtubeCallbackUrl: "",
    youtubeOAuthConfigured: true,
    catalog: publicDemoCatalog,
    configuration: {
      providers: {
        ai: { provider: "gloo", model: "auto", configured: true },
        scripture: { provider: "ao", bibleId: "BSB", configured: true },
      },
      deployments: [discord],
    },
    runtime: { deployments: [] },
  });
}

export async function runPublicDemoControl(
  current: ControlStatus,
  url: string,
  init: RequestInit | undefined,
  preview: (scenarioId: string) => Promise<ControlPreview>,
): Promise<{ status: ControlStatus; body: unknown }> {
  const requestUrl = new URL(url, "https://threadlight.demo");
  const path = requestUrl.pathname;
  const body = requestBody(init);
  if (path === "/api/control/status") return { status: current, body: current };
  if (path === "/api/control/preview" && init?.method === "POST") {
    const requestedScenario =
      typeof body.scenarioId === "string" &&
      publicPreviewScenarios.some((scenario) => scenario.id === body.scenarioId)
        ? body.scenarioId
        : undefined;
    const prompt = typeof body.prompt === "string" ? body.prompt.toLowerCase() : "";
    return {
      status: current,
      body: await preview(requestedScenario ?? (prompt.includes("pray") ? "prayer" : "grief")),
    };
  }

  const next = clonePublicDemoStatus(current);
  if (path === "/api/control/providers" && init?.method === "POST") {
    const providers = body as {
      ai?: { provider?: Provider; model?: string; glooModel?: string };
      scripture?: { provider?: "ao" | "youversion"; bibleId?: string };
    };
    if (providers.ai) {
      const provider = providers.ai.provider ?? next.configuration.providers.ai.provider;
      next.configuration.providers.ai = {
        ...next.configuration.providers.ai,
        ...providers.ai,
        provider,
        model:
          providers.ai.glooModel ?? providers.ai.model ?? next.configuration.providers.ai.model,
        configured: provider === "openai" || provider === "gloo",
      };
    }
    if (providers.scripture) {
      const provider =
        providers.scripture.provider ?? next.configuration.providers.scripture.provider;
      next.configuration.providers.scripture = {
        ...next.configuration.providers.scripture,
        ...providers.scripture,
        provider,
        configured: provider === "ao",
      };
    }
    return { status: withPublicDemoRuntime(next), body: { ok: true } };
  }

  if (path === "/api/control/deployments" && init?.method === "POST") {
    const kind = body.kind as DestinationKind | undefined;
    if (kind !== "discord" && kind !== "youtube-comments") {
      throw new Error("This destination is not available in the public demo.");
    }
    if (next.configuration.deployments.some((deployment) => deployment.kind === kind)) {
      throw new Error(
        `The public demo already has a ${kind === "discord" ? "Discord" : "YouTube Comments"} destination.`,
      );
    }
    const deployment = createPublicDemoDeployment(kind);
    next.configuration.deployments.push(deployment);
    return { status: withPublicDemoRuntime(next), body: { id: deployment.id } };
  }

  const deploymentMatch = path.match(/^\/api\/control\/deployments\/([^/]+)(?:\/(.+))?$/);
  if (!deploymentMatch) throw new Error("That public demo action is not available.");
  const deployment = next.configuration.deployments.find((item) => item.id === deploymentMatch[1]);
  if (!deployment) throw new Error("This demo destination no longer exists.");
  const action = deploymentMatch[2];

  if (!action && init?.method === "PATCH") {
    applyPublicDemoDeploymentUpdate(deployment, body);
    return { status: withPublicDemoRuntime(next), body: { ok: true } };
  }
  if (action === "launch" && init?.method === "POST") {
    deployment.state = "running";
    return { status: withPublicDemoRuntime(next), body: { ok: true } };
  }
  if (action === "pause" && init?.method === "POST") {
    deployment.state = "paused";
    return { status: withPublicDemoRuntime(next), body: { ok: true } };
  }
  if (action === "youtube/videos" && (init?.method ?? "GET") === "GET") {
    return { status: next, body: { videos: publicDemoVideos } };
  }
  if (action === "youtube/channels" && (init?.method ?? "GET") === "GET") {
    return {
      status: next,
      body: { channels: publicDemoYouTubeChannels, selectedChannelId: "demo-channel" },
    };
  }
  if (action === "discord/locations" && (init?.method ?? "GET") === "GET") {
    const selectedGuildId = requestUrl.searchParams.get("guildId") ?? "demo-live-tapestry";
    return {
      status: next,
      body: {
        servers: publicDemoDiscordServers,
        channels: selectedGuildId === "demo-live-tapestry" ? publicDemoDiscordChannels : [],
        selectedGuildId,
        selectedChannelId:
          selectedGuildId === "demo-live-tapestry" ? "demo-integrations" : undefined,
      },
    };
  }
  if (action === "youtube/scan" && init?.method === "POST") {
    const youtube = deployment.youtube;
    if (youtube && !youtube.drafts.some((draft) => draft.id === "demo-draft-1")) {
      youtube.drafts.push({
        id: "demo-draft-1",
        authorName: "Jordan M.",
        commentText: "This gave me language for a hard week. Thank you.",
        replyText: "Thank you for sharing that. I hope you find steady encouragement this week.",
        status: "pending",
      });
    }
    return { status: withPublicDemoRuntime(next), body: { ok: true } };
  }
  const draftMatch = action?.match(/^youtube\/drafts\/([^/]+)\/(approve|reject)$/);
  if (draftMatch && init?.method === "POST") {
    const draft = deployment.youtube?.drafts.find((item) => item.id === draftMatch[1]);
    if (draft) draft.status = draftMatch[2] === "approve" ? "posted" : "rejected";
    return { status: withPublicDemoRuntime(next), body: { ok: true } };
  }
  throw new Error("That public demo action is not available.");
}

function createPublicDemoDeployment(kind: "discord" | "youtube-comments"): Deployment {
  if (kind === "discord") {
    return {
      id: "demo-discord-added",
      kind,
      name: "Community prayer room",
      state: "draft",
      configured: false,
      discord: {
        applicationIdConfigured: false,
        botTokenConfigured: false,
        guildIdConfigured: false,
        channelIdConfigured: false,
        participationMode: "shy",
        quietSeconds: 20,
      },
    };
  }
  return {
    id: "demo-youtube",
    kind,
    name: "YouTube Comments",
    state: "draft",
    configured: true,
    youtube: {
      channelId: "demo-channel",
      channelName: "Threadlight Demo Channel",
      selectedVideos: publicDemoVideos.slice(0, 1),
      clientIdConfigured: true,
      clientSecretConfigured: true,
      refreshTokenConfigured: true,
      replyMode: "review",
      pollSeconds: 180,
      dailyReplyLimit: 12,
      replyCount: 0,
      drafts: [],
    },
  };
}

function applyPublicDemoDeploymentUpdate(deployment: Deployment, body: Record<string, unknown>) {
  const discord = body.discord as Record<string, unknown> | undefined;
  if (deployment.discord && discord) {
    deployment.discord = {
      ...deployment.discord,
      applicationIdConfigured:
        deployment.discord.applicationIdConfigured || Boolean(discord.applicationId),
      botTokenConfigured: deployment.discord.botTokenConfigured || Boolean(discord.botToken),
      guildIdConfigured: deployment.discord.guildIdConfigured || Boolean(discord.guildId),
      channelIdConfigured: deployment.discord.channelIdConfigured || Boolean(discord.channelId),
      participationMode:
        (discord.participationMode as Mode | undefined) ?? deployment.discord.participationMode,
      quietSeconds: Number(discord.quietSeconds ?? deployment.discord.quietSeconds),
    };
    deployment.configured =
      deployment.discord.applicationIdConfigured &&
      deployment.discord.botTokenConfigured &&
      deployment.discord.guildIdConfigured &&
      deployment.discord.channelIdConfigured;
  }
  const youtube = body.youtube as Record<string, unknown> | undefined;
  if (deployment.youtube && youtube) {
    deployment.youtube = {
      ...deployment.youtube,
      ...(youtube as Partial<NonNullable<Deployment["youtube"]>>),
    };
  }
}

function requestBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") return {};
  try {
    const parsed = JSON.parse(init.body);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function clonePublicDemoStatus(status: ControlStatus): ControlStatus {
  return JSON.parse(JSON.stringify(status)) as ControlStatus;
}

function withPublicDemoRuntime(status: ControlStatus): ControlStatus {
  return {
    ...status,
    runtime: {
      deployments: status.configuration.deployments.map((deployment) => ({
        id: deployment.id,
        state: deployment.state,
        ready: deployment.state === "running",
      })),
    },
  };
}

export function App() {
  const [publicDemo, setPublicDemo] = useState(
    () => new URLSearchParams(window.location.search).get("demo") === "public",
  );
  const publicDemoStatus = useRef(createPublicDemoStatus());
  const [status, setStatus] = useState<ControlStatus | undefined>(() =>
    publicDemo ? publicDemoStatus.current : undefined,
  );
  const [screen, setScreen] = useState<Screen>("choose");
  const [controlAccessCode, setControlAccessCode] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [busy, setBusy] = useState(false);

  const publicDemoRequest = useCallback<ControlRequest>(async (url, init) => {
    const result = await runPublicDemoControl(publicDemoStatus.current, url, init, (scenarioId) =>
      request<ControlPreview>("/api/demo/respond", {
        method: "POST",
        body: JSON.stringify({ scenarioId }),
      }),
    );
    publicDemoStatus.current = result.status;
    setStatus(result.status);
    return result.body as never;
  }, []);

  const controlRequest = useCallback<ControlRequest>(
    (url, init) =>
      publicDemo
        ? publicDemoRequest(url, init)
        : request(url, init, controlAccessCode || undefined),
    [controlAccessCode, publicDemo, publicDemoRequest],
  );

  const refresh = useCallback(async () => {
    const next = await controlRequest<ControlStatus>("/api/control/status");
    setStatus(next);
    return next;
  }, [controlRequest]);

  useEffect(() => {
    void refresh()
      .then((next) => {
        const youtubeResult = new URLSearchParams(window.location.search).get("youtube");
        const route = resolveStartupRoute(
          next.configuration.deployments,
          youtubeResult === "connected" || youtubeResult === "connection-failed"
            ? youtubeResult
            : undefined,
        );
        setSelectedId(route.selectedId);
        setScreen(route.screen);
        if (route.notice) setError(route.notice);
        if (youtubeResult) window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((reason: unknown) => {
        if (reason instanceof ControlAccessRequiredError) {
          const demo = publicDemoStatus.current;
          setPublicDemo(true);
          setStatus(demo);
          setScreen("home");
          return;
        }
        setError(reason instanceof Error ? reason.message : "Unable to reach Threadlight.");
      });
  }, [refresh]);

  const selected = useMemo(
    () => status?.configuration.deployments.find((deployment) => deployment.id === selectedId),
    [selectedId, status],
  );

  const createDeployment = async (kind: DestinationKind) => {
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const created = await controlRequest<{ id: string }>("/api/control/deployments", {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      await refresh();
      setSelectedId(created.id);
      setScreen("connect");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add this destination.");
    } finally {
      setBusy(false);
    }
  };

  const openDeployment = (deployment: Deployment) => {
    setError(undefined);
    setSuccess(undefined);
    setSelectedId(deployment.id);
    setScreen("connect");
  };

  if (!status)
    return (
      <Loading
        error={error}
        onRetry={() =>
          void refresh().catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : "Unable to reach Threadlight."),
          )
        }
      />
    );

  return (
    <ControlRequestContext.Provider value={controlRequest}>
      <main className="app-shell">
        <Header
          onSettings={() => setScreen("settings")}
          onManage={publicDemo ? () => setScreen("access") : undefined}
          onExit={
            controlAccessCode
              ? () => {
                  setControlAccessCode("");
                  setPublicDemo(true);
                  setStatus(publicDemoStatus.current);
                  setScreen("home");
                  setSuccess("Returned to the public demo workspace.");
                }
              : undefined
          }
          context={
            publicDemo
              ? "Public demo workspace"
              : controlAccessCode
                ? "Hosted control"
                : "Local control"
          }
        />
        {publicDemo && (
          <p className="demo-workspace-note">
            Live destinations are read-only here. Join Discord or open the YouTube test video to
            interact; setup changes stay in this browser.
          </p>
        )}
        {error && <Notice text={error} onDismiss={() => setError(undefined)} />}
        {success && (
          <Notice text={success} tone="success" onDismiss={() => setSuccess(undefined)} />
        )}
        {screen === "choose" && (
          <ChooseDestination
            catalog={status.catalog}
            busy={busy}
            publicDemo={publicDemo}
            onChoose={createDeployment}
          />
        )}
        {screen === "connect" && selected && (
          <ConnectDestination
            deployment={selected}
            youtubeOAuthConfigured={status.youtubeOAuthConfigured}
            onBack={() => setScreen("choose")}
            onContinue={() => setScreen("launch")}
            onSaved={refresh}
            onError={setError}
          />
        )}
        {screen === "launch" && selected && (
          <ConfigureAndLaunch
            deployment={selected}
            publicDemo={publicDemo}
            initialProvider={status.configuration.providers.ai}
            initialScripture={status.configuration.providers.scripture}
            onBack={() => setScreen("connect")}
            onLaunched={async () => {
              await refresh();
              setScreen("home");
              setSuccess(
                publicDemo
                  ? `${selected.name} is ready in the browser-only demo workspace.`
                  : `${selected.name} is live and ready to monitor.`,
              );
            }}
            onError={setError}
          />
        )}
        {screen === "home" && (
          <LiveDashboard
            status={status}
            publicDemo={publicDemo}
            onAdd={() => {
              setError(undefined);
              setSuccess(undefined);
              setSelectedId(undefined);
              setScreen("choose");
            }}
            onOpen={openDeployment}
            onPause={async (id) => {
              try {
                await controlRequest(`/api/control/deployments/${id}/pause`, { method: "POST" });
                await refresh();
                setSuccess("Deployment paused. Threadlight will stop processing new activity.");
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "Unable to pause this destination.",
                );
              }
            }}
          />
        )}
        {screen === "settings" && (
          <SettingsPanel
            initialProvider={status.configuration.providers.ai}
            initialScripture={status.configuration.providers.scripture}
            onBack={() => setScreen(status.configuration.deployments.length ? "home" : "choose")}
            onSaved={async () => {
              await refresh();
              setScreen("home");
              setSuccess("Provider settings saved.");
            }}
            onError={setError}
          />
        )}
        {screen === "access" && (
          <ControlAccessPanel
            onBack={() => setScreen("home")}
            onUnlocked={(code, next) => {
              setControlAccessCode(code);
              setPublicDemo(false);
              setStatus(next);
              setScreen("home");
              setError(undefined);
              setSuccess("Operator controls unlocked for this browser session.");
            }}
          />
        )}
      </main>
    </ControlRequestContext.Provider>
  );
}

function Header({
  onSettings,
  onManage,
  onExit,
  context = "Local control",
}: {
  onSettings: () => void;
  onManage?: () => void;
  onExit?: () => void;
  context?: string;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <Flame size={19} />
        <span>Threadlight</span>
      </div>
      <div className="topbar-actions">
        <span className="local-state">
          <i />
          {context}
        </span>
        {onManage && (
          <button className="topbar-command" type="button" onClick={onManage}>
            <LockKeyhole size={15} />
            Manage
          </button>
        )}
        {onExit && (
          <button className="topbar-command" type="button" onClick={onExit}>
            Exit control
          </button>
        )}
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Settings">
          <Settings2 size={18} />
        </button>
      </div>
    </header>
  );
}

function ControlAccessPanel({
  onBack,
  onUnlocked,
}: {
  onBack: () => void;
  onUnlocked: (code: string, status: ControlStatus) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError(undefined);
    try {
      const next = await request<ControlStatus>(
        "/api/control/status",
        undefined,
        code.trim() || undefined,
      );
      onUnlocked(code.trim(), next);
    } catch (reason) {
      setError(
        reason instanceof ControlAccessRequiredError
          ? "That access code was not accepted."
          : reason instanceof Error
            ? reason.message
            : "Threadlight control is unavailable.",
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <section className="wizard narrow access-panel">
      <p className="eyebrow">Operator access</p>
      <h1>Manage this Threadlight.</h1>
      <p className="lede">
        Enter the deployment access code to edit destinations, launch connectors, and inspect
        operational activity. The code stays only in this browser session.
      </p>
      <form onSubmit={submit}>
        <Field label="Access code" hint="Configured by the deployment operator">
          <input
            autoComplete="current-password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            type="password"
            placeholder="Enter access code"
          />
        </Field>
        {error && (
          <p className="error-copy" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="text-button" onClick={onBack}>
            Back to public demo
          </button>
          <button type="submit" className="primary" disabled={checking || !code.trim()}>
            {checking ? "Checking..." : "Unlock controls"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Loading({ error, onRetry }: { error?: string; onRetry: () => void }) {
  return (
    <main className="app-shell">
      <Header onSettings={() => undefined} />
      <section className="loading">
        <Sparkles size={22} />
        <p>{error ?? "Opening your local Threadlight..."}</p>
        {error && (
          <button className="text-button" type="button" onClick={onRetry}>
            Try again
          </button>
        )}
      </section>
    </main>
  );
}

function Notice({
  text,
  tone = "error",
  onDismiss,
}: {
  text: string;
  tone?: "error" | "success";
  onDismiss: () => void;
}) {
  return (
    <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {tone === "error" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
      <span>{text}</span>
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  );
}

function ChooseDestination({
  catalog,
  busy,
  publicDemo,
  onChoose,
}: {
  catalog: ControlStatus["catalog"];
  busy: boolean;
  publicDemo: boolean;
  onChoose: (kind: DestinationKind) => void;
}) {
  return (
    <section className="wizard narrow">
      <p className="step step-1">Setup · 1 of 3</p>
      <p className="eyebrow">Start a deployment</p>
      <h1 id="destination-heading">Choose a destination.</h1>
      <p className="lede">Threadlight can serve one or more places. Start with one.</p>
      <section className="route-list" aria-labelledby="destination-heading">
        {catalog.map((destination) => {
          const Icon = icons[destination.kind];
          const unavailable = destination.state !== "available";
          const availabilityLabel = destination.state === "planned" ? "Planned" : "Coming soon";
          return (
            <button
              className={`route-row ${unavailable ? "unavailable" : ""}`}
              type="button"
              key={destination.kind}
              disabled={busy || unavailable}
              onClick={() => onChoose(destination.kind)}
            >
              <span className="route-icon">
                <Icon size={22} />
              </span>
              <span>
                <strong>{destination.label}</strong>
                <small>{unavailable ? availabilityLabel : descriptions[destination.kind]}</small>
              </span>
              {unavailable ? (
                <small className="coming">{availabilityLabel}</small>
              ) : destination.kind === "discord" ? (
                <span className="route-trailing">
                  <small>Recommended</small>
                  <ArrowRight size={18} />
                </span>
              ) : (
                <ArrowRight size={18} />
              )}
            </button>
          );
        })}
      </section>
      <p className="local-note">
        <LockKeyhole size={15} />
        {publicDemo
          ? "Demo changes stay in this browser and never connect to an account."
          : "Keys and settings stay in your local Threadlight volume."}
      </p>
    </section>
  );
}

function ConnectDestination({
  deployment,
  youtubeOAuthConfigured,
  onBack,
  onContinue,
  onSaved,
  onError,
}: {
  deployment: Deployment;
  youtubeOAuthConfigured: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSaved: () => Promise<unknown>;
  onError: (value: string) => void;
}) {
  if (deployment.kind === "youtube-comments") {
    return (
      <YouTubeConnection
        deployment={deployment}
        youtubeOAuthConfigured={youtubeOAuthConfigured}
        onBack={onBack}
        onContinue={onContinue}
        onSaved={onSaved}
        onError={onError}
      />
    );
  }
  if (deployment.kind !== "discord")
    return <PlannedConnector deployment={deployment} onBack={onBack} />;
  return (
    <DiscordConnection
      deployment={deployment}
      onBack={onBack}
      onContinue={onContinue}
      onSaved={onSaved}
      onError={onError}
    />
  );
}

function DiscordConnection({
  deployment,
  onBack,
  onContinue,
  onSaved,
  onError,
}: {
  deployment: Deployment;
  onBack: () => void;
  onContinue: () => void;
  onSaved: () => Promise<unknown>;
  onError: (value: string) => void;
}) {
  const request = useControlRequest();
  const [form, setForm] = useState({ applicationId: "", botToken: "" });
  const [locations, setLocations] = useState<{
    servers: Array<{ id: string; name: string }>;
    channels: Array<{ id: string; name: string }>;
  }>();
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saved = deployment.discord;
  const [credentialsReady, setCredentialsReady] = useState(
    Boolean(saved?.applicationIdConfigured && saved.botTokenConfigured),
  );
  const loadLocations = useCallback(
    async (selectedGuildId?: string) => {
      setLocationsLoading(true);
      try {
        const query = selectedGuildId ? `?guildId=${encodeURIComponent(selectedGuildId)}` : "";
        const result = await request<{
          servers: Array<{ id: string; name: string }>;
          channels: Array<{ id: string; name: string }>;
          selectedGuildId?: string;
          selectedChannelId?: string;
        }>(`/api/control/deployments/${deployment.id}/discord/locations${query}`);
        setLocations(result);
        setGuildId((current) => current || result.selectedGuildId || "");
        setChannelId((current) => current || result.selectedChannelId || "");
      } catch (reason) {
        setLocations({ servers: [], channels: [] });
        onError(
          reason instanceof Error
            ? reason.message
            : "Threadlight could not load Discord servers and channels.",
        );
      } finally {
        setLocationsLoading(false);
      }
    },
    [deployment.id, onError, request],
  );
  useEffect(() => {
    if (credentialsReady) void loadLocations();
  }, [credentialsReady, loadLocations]);
  const saveCredentialsAndLoad = async () => {
    setSaving(true);
    onError("");
    try {
      await request(`/api/control/deployments/${deployment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ discord: omitEmpty(form) }),
      });
      await onSaved();
      setForm({ applicationId: "", botToken: "" });
      if (credentialsReady) await loadLocations();
      else setCredentialsReady(true);
    } catch (reason) {
      onError(
        reason instanceof Error ? reason.message : "Unable to connect the Discord application.",
      );
    } finally {
      setSaving(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      await request(`/api/control/deployments/${deployment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ discord: omitEmpty({ ...form, guildId, channelId }) }),
      });
      await onSaved();
      onContinue();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to save Discord settings.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="wizard form-wizard">
      <p className="step step-2">Setup · 2 of 3</p>
      <p className="eyebrow">Connect Discord</p>
      <h1>Choose where Threadlight listens.</h1>
      <p className="lede">
        Select a server and text channel the connected bot can access. Credentials stay on this
        machine and are never displayed again.
      </p>
      <form onSubmit={submit}>
        <Field
          label="Application ID"
          hint={saved?.applicationIdConfigured ? "Saved locally" : "From your Discord application"}
        >
          <input
            value={form.applicationId}
            onChange={(event) => setForm({ ...form, applicationId: event.target.value })}
            placeholder={
              saved?.applicationIdConfigured ? "Replace saved application ID" : "123456789012345678"
            }
          />
        </Field>
        <Field
          label="Bot token"
          hint={saved?.botTokenConfigured ? "Saved locally" : "From the Bot page"}
        >
          <input
            autoComplete="new-password"
            value={form.botToken}
            onChange={(event) => setForm({ ...form, botToken: event.target.value })}
            type="password"
            placeholder={saved?.botTokenConfigured ? "Replace saved bot token" : "Paste bot token"}
          />
        </Field>
        <div className="connection-stage">
          <span className={credentialsReady ? "ready" : ""}>
            {credentialsReady ? <CheckCircle2 size={16} /> : <LockKeyhole size={16} />}
            {credentialsReady
              ? "Discord credentials are saved. Server and channel choices are available."
              : "Save credentials before choosing a server and channel."}
          </span>
          <button
            type="button"
            className="text-button"
            disabled={
              saving ||
              (!saved?.applicationIdConfigured && !form.applicationId.trim()) ||
              (!saved?.botTokenConfigured && !form.botToken.trim())
            }
            onClick={() => void saveCredentialsAndLoad()}
          >
            {locationsLoading
              ? "Loading servers..."
              : credentialsReady && !form.applicationId && !form.botToken
                ? "Reload servers"
                : "Save credentials and load servers"}
          </button>
        </div>
        <div className="field-grid">
          <Field label="Server" hint="Servers available to the connected bot">
            {locations?.servers.length ? (
              <select
                value={guildId}
                disabled={locationsLoading}
                onChange={(event) => {
                  const nextGuildId = event.target.value;
                  setGuildId(nextGuildId);
                  setChannelId("");
                  void loadLocations(nextGuildId);
                }}
              >
                <option value="">Choose a server</option>
                {locations.servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={guildId}
                onChange={(event) => setGuildId(event.target.value)}
                disabled={!credentialsReady}
                placeholder={
                  locationsLoading ? "Loading servers..." : "Save a bot token to load servers"
                }
              />
            )}
          </Field>
          <Field label="Channel" hint="Threadlight listens here and in its child threads">
            {locations?.servers.length ? (
              <select
                value={channelId}
                disabled={locationsLoading || !guildId || locations.channels.length === 0}
                onChange={(event) => setChannelId(event.target.value)}
              >
                <option value="">
                  {locationsLoading ? "Loading channels..." : "Choose a text channel"}
                </option>
                {locations.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
                disabled={!credentialsReady}
                placeholder="Save a bot token to load channels"
              />
            )}
          </Field>
        </div>
        <p className="helper">
          <ExternalLink size={14} />
          Enable Message Content Intent before continuing.
        </p>
        <div className="form-actions">
          <button type="button" className="text-button" onClick={onBack}>
            Back
          </button>
          <button
            type="submit"
            className="primary"
            disabled={saving || !credentialsReady || !guildId || !channelId}
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                Continue <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function YouTubeConnection({
  deployment,
  youtubeOAuthConfigured,
  onBack,
  onContinue,
  onSaved,
  onError,
}: {
  deployment: Deployment;
  youtubeOAuthConfigured: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSaved: () => Promise<unknown>;
  onError: (value: string) => void;
}) {
  const request = useControlRequest();
  const saved = deployment.youtube;
  const [replyMode, setReplyMode] = useState(saved?.replyMode ?? "review");
  const [pollSeconds, setPollSeconds] = useState(String(saved?.pollSeconds ?? 180));
  const [dailyReplyLimit, setDailyReplyLimit] = useState(String(saved?.dailyReplyLimit ?? 12));
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [channelId, setChannelId] = useState(saved?.channelId ?? "");
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [videos, setVideos] = useState<Array<{ id: string; title: string; thumbnailUrl?: string }>>(
    [],
  );
  const [selectedVideoIds, setSelectedVideoIds] = useState(
    () => new Set(saved?.selectedVideos.map((video) => video.id) ?? []),
  );
  const [videosLoading, setVideosLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = Boolean(saved?.channelId && saved?.refreshTokenConfigured);
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    setChannelsLoading(true);
    void request<{
      channels: Array<{ id: string; name: string }>;
      selectedChannelId?: string;
    }>(`/api/control/deployments/${deployment.id}/youtube/channels`)
      .then((result) => {
        if (cancelled) return;
        setChannels(result.channels);
        setChannelId((current) => current || result.selectedChannelId || "");
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          onError(
            reason instanceof Error ? reason.message : "Threadlight could not load your channels.",
          );
      })
      .finally(() => {
        if (!cancelled) setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, deployment.id, onError, request]);
  useEffect(() => {
    if (!connected || !channelId) return;
    let cancelled = false;
    setVideosLoading(true);
    void request<{ videos: Array<{ id: string; title: string; thumbnailUrl?: string }> }>(
      `/api/control/deployments/${deployment.id}/youtube/videos?channelId=${encodeURIComponent(channelId)}`,
    )
      .then((result) => {
        if (!cancelled) setVideos(result.videos);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          onError(
            reason instanceof Error ? reason.message : "Threadlight could not load your videos.",
          );
      })
      .finally(() => {
        if (!cancelled) setVideosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, connected, deployment.id, onError, request]);
  const save = async () => {
    const available = new Map(
      [...videos, ...(saved?.selectedVideos ?? [])].map((video) => [video.id, video]),
    );
    const selectedVideos = [...selectedVideoIds]
      .map((id) => available.get(id))
      .filter((video): video is { id: string; title: string; thumbnailUrl?: string } =>
        Boolean(video),
      );
    await request(`/api/control/deployments/${deployment.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        youtube: {
          channelId,
          channelName:
            channels.find((channel) => channel.id === channelId)?.name ?? saved?.channelName,
          replyMode,
          pollSeconds: Number(pollSeconds),
          dailyReplyLimit: Number(dailyReplyLimit),
          ...(selectedVideos.length ? { selectedVideos } : {}),
        },
      }),
    });
    await onSaved();
  };
  const connect = async () => {
    setBusy(true);
    onError("");
    try {
      const { authorizationUrl } = await request<{ authorizationUrl: string }>(
        `/api/oauth/youtube/start?deploymentId=${deployment.id}`,
      );
      window.location.assign(authorizationUrl);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to start YouTube connection.");
      setBusy(false);
    }
  };
  const action = async (path: string, persistSettings = false) => {
    setBusy(true);
    try {
      await runYouTubeAction(save, () => request(path, { method: "POST" }), persistSettings);
      await onSaved();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to update YouTube Comments.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="wizard form-wizard">
      <p className="step step-2">Setup · 2 of 3</p>
      <p className="eyebrow">Connect YouTube</p>
      <h1>Bring Threadlight below your videos.</h1>
      <p className="lede">Comments become drafts by default. You choose what gets posted.</p>
      {!connected ? (
        <>
          <p className="helper">
            <ExternalLink size={14} /> Sign in with the Google account that owns the YouTube
            channel.
          </p>
          {!youtubeOAuthConfigured && (
            <p className="error-copy">
              YouTube sign-in has not been configured for this Threadlight installation.
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="text-button" onClick={onBack}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void connect()}
              disabled={busy || !youtubeOAuthConfigured}
            >
              {busy ? "Opening Google..." : "Connect Google account"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="helper">
            <ExternalLink size={14} /> Connected with the owner Google account. Choose which channel
            and videos Threadlight should watch.
          </p>
          <Field label="YouTube channel" hint="Channels available to the connected Google account">
            <select
              value={channelId}
              disabled={channelsLoading || channels.length === 0}
              onChange={(event) => {
                setChannelId(event.target.value);
                setSelectedVideoIds(new Set());
              }}
            >
              <option value="">
                {channelsLoading ? "Loading channels..." : "Choose a YouTube channel"}
              </option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Videos to watch"
            hint="Choose up to 10 videos. Threadlight ignores comments on every other video."
          >
            <div className="video-list">
              {videosLoading && <small>Loading your recent videos...</small>}
              {!videosLoading && channelId && videos.length === 0 && (
                <small>No videos were found for this channel.</small>
              )}
              {videos.map((video) => {
                const checked = selectedVideoIds.has(video.id);
                return (
                  <label
                    className={`video-option ${video.thumbnailUrl ? "with-thumbnail" : ""}`}
                    key={video.id}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedVideoIds((current) => {
                          const next = new Set(current);
                          if (next.has(video.id)) next.delete(video.id);
                          else if (next.size < 10) next.add(video.id);
                          return next;
                        })
                      }
                    />
                    {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" />}
                    <span>{video.title}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          <Field label="Reply policy">
            <select
              value={replyMode}
              onChange={(event) => setReplyMode(event.target.value as typeof replyMode)}
            >
              <option value="review">Review every reply</option>
              <option value="selective">Selective automatic replies</option>
              <option value="high-touch">High-touch review queue</option>
            </select>
          </Field>
          <div className="field-grid">
            <Field label="Polling interval (seconds)">
              <input
                type="number"
                min="60"
                max="3600"
                value={pollSeconds}
                onChange={(event) => setPollSeconds(event.target.value)}
              />
            </Field>
            <Field label="Daily reply limit">
              <input
                type="number"
                min="1"
                max="100"
                value={dailyReplyLimit}
                onChange={(event) => setDailyReplyLimit(event.target.value)}
              />
            </Field>
          </div>
          {deployment.state === "running" ? (
            <div className="form-actions">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  void action(`/api/control/deployments/${deployment.id}/youtube/scan`, true)
                }
                disabled={busy}
              >
                Scan now
              </button>
              <button type="button" className="primary" onClick={() => void save()} disabled={busy}>
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>
          ) : (
            <div className="form-actions">
              <button type="button" className="text-button" onClick={onBack}>
                Back
              </button>
              <button
                type="button"
                className="primary"
                onClick={() =>
                  void save()
                    .then(onContinue)
                    .catch((reason: unknown) =>
                      onError(
                        reason instanceof Error ? reason.message : "Choose at least one video.",
                      ),
                    )
                }
                disabled={busy || selectedVideoIds.size === 0}
              >
                Configure Threadlight <ArrowRight size={17} />
              </button>
            </div>
          )}
          {saved?.lastError && <p className="error-copy">{saved.lastError}</p>}
          {saved?.lastSafetyAlert && <p className="status-note">{saved.lastSafetyAlert}</p>}
          {saved?.drafts
            .filter((draft) => draft.status === "pending" || draft.status === "failed")
            .map((draft) => (
              <article className="deployment-row" key={draft.id}>
                <div>
                  <strong>
                    {draft.authorName} {draft.status === "failed" ? "· Needs attention" : ""}
                  </strong>
                  <small className="draft-label">Original comment</small>
                  <small>{draft.commentText}</small>
                  <small className="draft-label">Proposed reply</small>
                  <small>{draft.replyText}</small>
                  {draft.error && <small className="error-copy">{draft.error}</small>}
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    void action(
                      `/api/control/deployments/${deployment.id}/youtube/drafts/${draft.id}/reject`,
                    )
                  }
                  disabled={busy}
                >
                  {draft.status === "failed" ? "Dismiss" : "Reject"}
                </button>
                {draft.status === "pending" && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      void action(
                        `/api/control/deployments/${deployment.id}/youtube/drafts/${draft.id}/approve`,
                      )
                    }
                    disabled={busy}
                  >
                    Post reply
                  </button>
                )}
              </article>
            ))}
        </>
      )}
    </section>
  );
}

function PlannedConnector({ deployment, onBack }: { deployment: Deployment; onBack: () => void }) {
  const name = deployment.kind === "slack" ? "Slack" : "YouTube Comments";
  return (
    <section className="wizard narrow">
      <p className="step step-2">Setup · 2 of 3</p>
      <p className="eyebrow">{name}</p>
      <h1>{name} is next.</h1>
      <p className="lede">
        This deployment slot is saved locally. Its connector needs an OAuth implementation before
        Threadlight can launch there.
      </p>
      <button type="button" className="primary" onClick={onBack}>
        Choose another destination
      </button>
    </section>
  );
}

function ConfigureAndLaunch({
  deployment,
  publicDemo,
  initialProvider,
  initialScripture,
  onBack,
  onLaunched,
  onError,
}: {
  deployment: Deployment;
  publicDemo: boolean;
  initialProvider: ControlStatus["configuration"]["providers"]["ai"];
  initialScripture: ControlStatus["configuration"]["providers"]["scripture"];
  onBack: () => void;
  onLaunched: () => Promise<void>;
  onError: (value: string) => void;
}) {
  const request = useControlRequest();
  const [provider, setProvider] = useState<Provider>(initialProvider.provider);
  const [model, setModel] = useState(initialProvider.model);
  const [apiKey, setApiKey] = useState("");
  const [providerIdentity, setProviderIdentity] = useState("");
  const [mode, setMode] = useState<Mode>(deployment.discord?.participationMode ?? "shy");
  const [saving, setSaving] = useState(false);
  const [providerCheck, setProviderCheck] = useState<"idle" | "running" | "passed" | "failed">(
    "idle",
  );
  const [providerCheckMessage, setProviderCheckMessage] = useState<string>();
  const providerAlreadyConfigured =
    initialProvider.configured && provider === initialProvider.provider;
  const providerReady = canLaunchSelectedProvider({
    provider,
    alreadyConfigured: providerAlreadyConfigured,
    credential: apiKey,
    identity: providerIdentity,
  });
  const providerLabel =
    provider === "gloo"
      ? "Gloo"
      : provider === "bonfire"
        ? "Bonfire"
        : provider[0]?.toUpperCase() + provider.slice(1);
  const targetLabel =
    deployment.kind === "discord"
      ? "Connected Discord channel"
      : `${deployment.youtube?.selectedVideos.length ?? 0} selected YouTube ${
          deployment.youtube?.selectedVideos.length === 1 ? "video" : "videos"
        }`;
  const behaviorLabel =
    deployment.kind === "discord"
      ? `${participationModeLabels[mode]} participation`
      : deployment.youtube?.replyMode === "selective"
        ? "Selective automatic replies"
        : deployment.youtube?.replyMode === "high-touch"
          ? "High-touch review queue"
          : "Review every reply";
  const scriptureLabel =
    initialScripture.provider === "ao" ? "AO Lab Scripture" : "YouVersion Scripture";
  const resetProviderCheck = () => {
    setProviderCheck("idle");
    setProviderCheckMessage(undefined);
  };
  const selectProvider = (item: Provider) => {
    setModel(modelAfterProviderChange(provider, model, item));
    setProvider(item);
    resetProviderCheck();
  };
  const saveProviders = async () => {
    const providerKey =
      provider === "openai"
        ? apiKey
          ? { openaiApiKey: apiKey }
          : {}
        : provider === "gemini"
          ? apiKey
            ? { geminiApiKey: apiKey }
            : {}
          : provider === "gloo"
            ? {
                ...(providerIdentity ? { glooClientId: providerIdentity } : {}),
                ...(apiKey ? { glooClientSecret: apiKey } : {}),
                glooModel: model,
              }
            : { ...(apiKey ? { bonfireApiKey: apiKey } : {}), bonfireModel: model };
    await request("/api/control/providers", {
      method: "POST",
      body: JSON.stringify({
        ai: { provider, model, ...providerKey },
        scripture: initialScripture,
      }),
    });
  };
  const runProviderCheck = async () => {
    setProviderCheck("running");
    setProviderCheckMessage(undefined);
    onError("");
    try {
      await saveProviders();
      const result = await request<ControlPreview>("/api/control/preview", {
        method: "POST",
        body: JSON.stringify({
          prompt: "Please offer one brief Scripture reflection on patience.",
        }),
      });
      setProviderCheck("passed");
      setProviderCheckMessage(
        result.reply?.passage
          ? `${publicDemo ? "Sandbox check: " : ""}${result.reply.passage.reference} returned in ${
              result.trace.totalMs
            } ms.`
          : `${publicDemo ? "Sandbox provider check" : "Provider check"} completed in ${
              result.trace.totalMs
            } ms.`,
      );
    } catch (reason) {
      setProviderCheck("failed");
      setProviderCheckMessage(
        reason instanceof Error ? reason.message : "The provider check did not complete.",
      );
    }
  };
  const launch = async () => {
    setSaving(true);
    onError("");
    try {
      await saveProviders();
      if (deployment.kind === "discord") {
        await request(`/api/control/deployments/${deployment.id}`, {
          method: "PATCH",
          body: JSON.stringify({ discord: { participationMode: mode } }),
        });
      }
      await request(`/api/control/deployments/${deployment.id}/launch`, { method: "POST" });
      await onLaunched();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to launch Threadlight.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="wizard form-wizard" onSubmit={(event) => event.preventDefault()}>
      <p className="step step-3">Deploy · 3 of 3</p>
      <p className="eyebrow">
        {deployment.kind === "discord" ? "Set Threadlight's presence" : "Configure Threadlight"}
      </p>
      <h1>
        {deployment.kind === "discord"
          ? "Choose how Threadlight responds."
          : "Choose Threadlight's model."}
      </h1>
      <p className="lede">
        {deployment.kind === "discord"
          ? "Start quietly. You can change this for this destination any time."
          : "Your connected YouTube channel will use this local provider configuration."}
      </p>
      {deployment.kind === "discord" && (
        <div className="mode-row">
          {(["shy", "medium", "high"] as Mode[]).map((item) => (
            <button
              type="button"
              className={`mode ${mode === item ? "selected" : ""}`}
              key={item}
              onClick={() => setMode(item)}
              aria-pressed={mode === item}
            >
              <strong>{participationModeLabels[item]}</strong>
              <small>
                {item === "shy"
                  ? "Only when asked."
                  : item === "medium"
                    ? "When a room needs a thoughtful response."
                    : "Respond to every message."}
              </small>
            </button>
          ))}
        </div>
      )}
      <section className="provider-section">
        <p className="eyebrow">Model provider</p>
        <div className="provider-row">
          {(["openai", "gemini", "gloo", "bonfire"] as Provider[]).map((item) => (
            <button
              type="button"
              className={provider === item ? "provider selected" : "provider"}
              key={item}
              onClick={() => selectProvider(item)}
              aria-pressed={provider === item}
            >
              {item === "gloo"
                ? "Gloo"
                : item === "bonfire"
                  ? "Bonfire"
                  : item[0]?.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {provider === "gemini" || provider === "bonfire" ? (
          <p className="status-note">
            This provider can be saved now; its live runtime adapter is still being added.
          </p>
        ) : null}
        <div className="field-grid">
          <Field label="Model">
            <input
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                resetProviderCheck();
              }}
              placeholder="Model name"
            />
          </Field>
          {provider === "gloo" && (
            <Field label="Gloo client ID">
              <input
                value={providerIdentity}
                onChange={(event) => {
                  setProviderIdentity(event.target.value);
                  resetProviderCheck();
                }}
                placeholder="Client ID"
              />
            </Field>
          )}
          <Field
            label={provider === "gloo" ? "Gloo client secret" : "Provider credential"}
            hint={
              initialProvider.configured && provider === initialProvider.provider
                ? "A credential is already saved locally"
                : undefined
            }
          >
            <input
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                resetProviderCheck();
              }}
              type="password"
              placeholder="Paste credential"
            />
          </Field>
        </div>
      </section>
      <section className={`provider-preflight ${providerCheck}`}>
        <div>
          <strong>{publicDemo ? "Sandbox provider check" : "Provider check"}</strong>
          <small>
            {publicDemo
              ? "Validate this browser-only configuration. Nothing is posted to Discord or YouTube."
              : "Run one private test before deployment. Nothing is posted to Discord or YouTube."}
          </small>
          {providerCheckMessage && <span>{providerCheckMessage}</span>}
        </div>
        <button
          type="button"
          className="text-button"
          disabled={!providerReady || providerCheck === "running"}
          onClick={() => void runProviderCheck()}
        >
          {providerCheck === "running" ? (
            "Checking..."
          ) : providerCheck === "passed" ? (
            <>
              <CheckCircle2 size={16} /> Check again
            </>
          ) : (
            <>
              <Sparkles size={16} /> Save and test
            </>
          )}
        </button>
      </section>
      <section className="launch-review" aria-labelledby="launch-review-heading">
        <div>
          <p className="eyebrow">Ready to deploy</p>
          <h2 id="launch-review-heading">Review this deployment.</h2>
          <p className="launch-review-copy">
            {publicDemo
              ? "This walkthrough launches only in this browser. The live destinations remain read-only."
              : "Launching starts the listener immediately. You can pause or edit it from monitoring."}
          </p>
        </div>
        <dl>
          <div className="launch-review-row">
            <dt>
              <CheckCircle2 size={16} /> Destination
            </dt>
            <dd>{targetLabel}</dd>
          </div>
          <div className="launch-review-row">
            <dt>
              <CheckCircle2 size={16} /> Presence
            </dt>
            <dd>{behaviorLabel}</dd>
          </div>
          <div className="launch-review-row">
            <dt>
              <CheckCircle2 size={16} /> Intelligence
            </dt>
            <dd>
              {providerLabel} · {model}
            </dd>
          </div>
          <div className="launch-review-row">
            <dt>
              <CheckCircle2 size={16} /> Scripture
            </dt>
            <dd>{scriptureLabel}</dd>
          </div>
        </dl>
      </section>
      <div className="form-actions">
        <button type="button" className="text-button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || !providerReady || providerCheck !== "passed"}
          onClick={() => void launch()}
        >
          {saving ? (
            "Launching..."
          ) : (
            <>
              <Play size={16} />
              Launch Threadlight
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function SettingsPanel({
  initialProvider,
  initialScripture,
  onBack,
  onSaved,
  onError,
}: {
  initialProvider: ControlStatus["configuration"]["providers"]["ai"];
  initialScripture: ControlStatus["configuration"]["providers"]["scripture"];
  onBack: () => void;
  onSaved: () => Promise<void>;
  onError: (value: string) => void;
}) {
  const request = useControlRequest();
  const [provider, setProvider] = useState<Provider>(initialProvider.provider);
  const [model, setModel] = useState(initialProvider.model);
  const [credential, setCredential] = useState("");
  const [providerIdentity, setProviderIdentity] = useState("");
  const [scripture, setScripture] = useState(initialScripture.provider);
  const [bibleId, setBibleId] = useState(initialScripture.bibleId);
  const [scriptureCredential, setScriptureCredential] = useState("");
  const [saving, setSaving] = useState(false);
  const selectProvider = (item: Provider) => {
    setModel(modelAfterProviderChange(provider, model, item));
    setProvider(item);
  };
  const save = async () => {
    setSaving(true);
    onError("");
    try {
      const key =
        provider === "openai"
          ? credential
            ? { openaiApiKey: credential }
            : {}
          : provider === "gemini"
            ? credential
              ? { geminiApiKey: credential }
              : {}
            : provider === "gloo"
              ? credential
                ? {
                    ...(providerIdentity ? { glooClientId: providerIdentity } : {}),
                    glooClientSecret: credential,
                    glooModel: model,
                  }
                : {
                    ...(providerIdentity ? { glooClientId: providerIdentity } : {}),
                    glooModel: model,
                  }
              : credential
                ? { bonfireApiKey: credential, bonfireModel: model }
                : { bonfireModel: model };
      await request("/api/control/providers", {
        method: "POST",
        body: JSON.stringify({
          ai: { provider, model, ...key },
          scripture: {
            provider: scripture,
            bibleId,
            ...(scriptureCredential ? { youVersionAppKey: scriptureCredential } : {}),
          },
        }),
      });
      await onSaved();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="wizard form-wizard">
      <p className="eyebrow">Local settings</p>
      <h1>Threadlight configuration.</h1>
      <p className="lede">Credentials remain local and are never shown again after saving.</p>
      <section className="provider-section">
        <p className="eyebrow">Model provider</p>
        <div className="provider-row">
          {(["openai", "gemini", "gloo", "bonfire"] as Provider[]).map((item) => (
            <button
              type="button"
              className={provider === item ? "provider selected" : "provider"}
              key={item}
              onClick={() => selectProvider(item)}
            >
              {item === "gloo"
                ? "Gloo"
                : item === "bonfire"
                  ? "Bonfire"
                  : item[0]?.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <Field label="Model">
            <input value={model} onChange={(event) => setModel(event.target.value)} />
          </Field>
          <Field
            label="Provider credential"
            hint={
              initialProvider.configured && provider === initialProvider.provider
                ? "Saved locally"
                : undefined
            }
          >
            <input
              autoComplete="new-password"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              type="password"
              placeholder="Paste credential"
            />
          </Field>
          {provider === "gloo" && (
            <Field label="Gloo client ID">
              <input
                value={providerIdentity}
                onChange={(event) => setProviderIdentity(event.target.value)}
                placeholder="Client ID"
              />
            </Field>
          )}
        </div>
      </section>
      <section className="provider-section">
        <p className="eyebrow">Scripture source</p>
        <div className="provider-row">
          {(["ao", "youversion"] as const).map((item) => (
            <button
              type="button"
              className={scripture === item ? "provider selected" : "provider"}
              key={item}
              onClick={() => setScripture(item)}
              aria-pressed={scripture === item}
            >
              {item === "ao" ? "AO Lab" : "YouVersion"}
            </button>
          ))}
        </div>
        <Field
          label="Bible ID"
          hint={
            scripture === "youversion"
              ? "Use 3034 for BSB, or an available abbreviation such as BSB."
              : undefined
          }
        >
          <input value={bibleId} onChange={(event) => setBibleId(event.target.value)} />
        </Field>
        {scripture === "youversion" && (
          <Field
            label="YouVersion app key"
            hint={
              initialScripture.configured && scripture === initialScripture.provider
                ? "Saved locally"
                : undefined
            }
          >
            <input
              autoComplete="new-password"
              value={scriptureCredential}
              onChange={(event) => setScriptureCredential(event.target.value)}
              type="password"
              placeholder="Paste app key"
            />
          </Field>
        )}
      </section>
      <div className="form-actions">
        <button type="button" className="text-button" onClick={onBack}>
          Back
        </button>
        <button type="button" className="primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </section>
  );
}

function LiveDashboard({
  status,
  publicDemo,
  onAdd,
  onOpen,
  onPause,
}: {
  status: ControlStatus;
  publicDemo: boolean;
  onAdd: () => void;
  onOpen: (deployment: Deployment) => void;
  onPause: (id: string) => Promise<void>;
}) {
  const request = useControlRequest();
  const [view, setView] = useState<"deployments" | "activity">(
    publicDemo ? "activity" : "deployments",
  );
  const [prompt, setPrompt] = useState(
    "I feel overwhelmed today. Could you offer a brief reflection?",
  );
  const [scenarioId, setScenarioId] =
    useState<(typeof publicPreviewScenarios)[number]["id"]>("grief");
  const [preview, setPreview] = useState<ControlPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError(undefined);
    try {
      setPreview(
        await request<ControlPreview>("/api/control/preview", {
          method: "POST",
          body: JSON.stringify(publicDemo ? { scenarioId } : { prompt }),
        }),
      );
    } catch (reason) {
      setPreviewError(
        reason instanceof Error ? reason.message : "Threadlight could not form a test response.",
      );
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">{publicDemo ? "Public demo workspace" : "Local control"}</p>
          <h1>Threadlight</h1>
          <p className="lede">
            {publicDemo
              ? "A Scripture-grounded companion that brings thoughtful presence into live Discord and YouTube conversations."
              : "Your deployments stay on this machine."}
          </p>
        </div>
        <button className="primary" type="button" onClick={onAdd}>
          Add destination <ArrowRight size={17} />
        </button>
      </div>
      {publicDemo && (
        <section className="judge-proof" aria-label="Hackathon demo proof">
          <div>
            <p className="eyebrow">Scripture in New Frontiers</p>
            <strong>Real connectors. Visible discernment. Human review.</strong>
            <p>
              Follow live activity, inspect Scripture attribution and provider traces, then walk
              through the complete setup flow without changing the running deployment.
            </p>
          </div>
          <div className="judge-proof-links">
            <span>Gloo AI Studio integrated</span>
            <span>Discord + YouTube live</span>
            <a href="https://github.com/Living-LIVE/threadlight" target="_blank" rel="noreferrer">
              View source <ExternalLink size={14} />
            </a>
          </div>
        </section>
      )}
      <nav className="workspace-tabs" aria-label="Threadlight workspace">
        <button
          type="button"
          className={view === "deployments" ? "selected" : ""}
          aria-current={view === "deployments" ? "page" : undefined}
          onClick={() => setView("deployments")}
        >
          <Rocket size={16} /> Deployments
        </button>
        <button
          type="button"
          className={view === "activity" ? "selected" : ""}
          aria-current={view === "activity" ? "page" : undefined}
          onClick={() => setView("activity")}
        >
          <Activity size={16} /> Monitoring
        </button>
      </nav>
      {view === "activity" ? (
        <MonitoringConsole publicDemo={publicDemo} />
      ) : (
        <>
          <section className="deployment-list">
            <div className="list-title">
              <h2>{publicDemo ? "Configuration playground" : "Destinations"}</h2>
              <span>{status.configuration.deployments.length}</span>
            </div>
            {status.configuration.deployments.map((deployment) => {
              const runtime = status.runtime.deployments.find(
                (entry) => entry?.id === deployment.id,
              );
              const Icon = icons[deployment.kind];
              return (
                <article className="deployment-row" key={deployment.id}>
                  <span className="route-icon">
                    <Icon size={21} />
                  </span>
                  <div>
                    <strong>{deployment.name}</strong>
                    <small>
                      {deployment.kind === "discord"
                        ? participationModeLabels[deployment.discord?.participationMode ?? "shy"]
                        : deployment.kind === "youtube-comments" && deployment.youtube
                          ? youtubeHealth(deployment.youtube)
                          : descriptions[deployment.kind]}
                    </small>
                    {runtime?.message && <small className="error-copy">{runtime.message}</small>}
                  </div>
                  <span className={`state ${runtime?.ready ? "live" : ""}`}>
                    {runtime?.ready
                      ? "Live"
                      : deployment.state === "paused"
                        ? "Paused"
                        : deployment.state === "error"
                          ? "Needs attention"
                          : "Set up"}
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Open ${deployment.name}`}
                    onClick={() => onOpen(deployment)}
                  >
                    <ArrowRight size={18} />
                  </button>
                  {deployment.state === "running" && (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Pause ${deployment.name}`}
                      onClick={() => void onPause(deployment.id)}
                    >
                      <CirclePause size={18} />
                    </button>
                  )}
                </article>
              );
            })}
          </section>
          <section className="preview-panel" aria-labelledby="preview-heading">
            <div>
              <p className="eyebrow">Provider check</p>
              <h2 id="preview-heading">
                {publicDemo ? "Run a live response." : "Run a test response."}
              </h2>
              <p>
                {publicDemo
                  ? "Runs one curated, credential-free scenario through the hosted provider pair. Nothing is posted."
                  : "Uses your saved provider settings. No message is sent to a destination."}
              </p>
            </div>
            {publicDemo ? (
              <div className="preview-field">
                <label htmlFor="public-preview-scenario">Sample scenario</label>
                <select
                  id="public-preview-scenario"
                  value={scenarioId}
                  onChange={(event) => {
                    setScenarioId(
                      event.target.value as (typeof publicPreviewScenarios)[number]["id"],
                    );
                    setPreview(undefined);
                    setPreviewError(undefined);
                  }}
                >
                  {publicPreviewScenarios.map((scenario) => (
                    <option value={scenario.id} key={scenario.id}>
                      {scenario.label}
                    </option>
                  ))}
                </select>
                <p className="scenario-prompt">
                  {publicPreviewScenarios.find((scenario) => scenario.id === scenarioId)?.prompt}
                </p>
              </div>
            ) : (
              <label className="preview-field">
                <span>Test message</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                />
              </label>
            )}
            <div className="preview-actions">
              <button
                className="text-button"
                type="button"
                disabled={previewing || (!publicDemo && !prompt.trim())}
                onClick={() => void runPreview()}
              >
                <Sparkles size={16} />
                {previewing ? "Running..." : publicDemo ? "Run live response" : "Run test response"}
              </button>
            </div>
            {previewError && <p className="error-copy">{previewError}</p>}
            {preview && (
              <article className="preview-result">
                <p className="preview-message">
                  {preview.reply?.message ?? preview.decision.reason}
                </p>
                {preview.reply?.passage && (
                  <p className="preview-passage">
                    {preview.reply.passage.reference} · {preview.reply.passage.translation}
                    <br />
                    <span>{preview.reply.passage.attribution}</span>
                  </p>
                )}
                <small>
                  {preview.trace.aiProvider} + {preview.trace.scriptureProvider} ·{" "}
                  {preview.trace.totalMs} ms
                </small>
              </article>
            )}
          </section>
        </>
      )}
      <div className="dashboard-foot">
        <LockKeyhole size={15} />
        {publicDemo
          ? "Demo state is stored only in this browser tab."
          : "Configuration is stored in your local Threadlight volume."}
      </div>
    </section>
  );
}

function MonitoringConsole({ publicDemo }: { publicDemo: boolean }) {
  const controlRequest = useControlRequest();
  const [live, setLive] = useState<PublicLiveStatus>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        setLive(
          publicDemo
            ? await request<PublicLiveStatus>("/api/demo/live")
            : await controlRequest<PublicLiveStatus>("/api/control/activity"),
        );
        setError(undefined);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Live status is temporarily unavailable.",
        );
      } finally {
        if (manual) setRefreshing(false);
      }
    },
    [controlRequest, publicDemo],
  );

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const errors = live
    ? [
        live.discord.message,
        live.youtube.lastError,
        ...live.activity.filter((event) => event.status === "error").map((event) => event.reason),
      ].filter((value): value is string => Boolean(value))
    : [];
  const filteredActivity = live ? filterActivity(live.activity, filter) : [];
  const liveConnectorCount = live ? Number(live.discord.ready) + Number(live.youtube.ready) : 0;

  return (
    <section className="live-console" aria-labelledby="live-console-heading">
      <div className="live-console-heading">
        <div>
          <p className="eyebrow">{publicDemo ? "Live demo" : "Operations"}</p>
          <h2 id="live-console-heading">
            {publicDemo ? "Watch Threadlight work." : "Monitor Threadlight."}
          </h2>
          <p>
            {publicDemo
              ? "Join the demo conversation or open the selected video. Activity refreshes live."
              : "Review connector health, responses, intentional skips, and errors in one place."}
          </p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Refresh live activity"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          <RefreshCw size={17} className={refreshing ? "spin" : undefined} />
        </button>
      </div>
      {error && <p className="live-error">{error}</p>}
      {!live && !error && <p className="live-loading">Loading live destinations...</p>}
      {live && (
        <>
          <section className="monitor-summary" aria-label="Monitoring summary">
            <div>
              <strong>{liveConnectorCount}</strong>
              <span>Live connectors</span>
            </div>
            <div>
              <strong>{live.activity.length}</strong>
              <span>Recent events</span>
            </div>
            <div className={errors.length ? "attention" : ""}>
              <strong>{errors.length}</strong>
              <span>Errors</span>
            </div>
          </section>
          <div className="live-destinations">
            <article className="live-destination">
              <div className="live-destination-title">
                <span className="route-icon">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <strong>{live.discord.name}</strong>
                  <small>{live.discord.participationLabel ?? "Not configured"}</small>
                </div>
                <LiveState ready={live.discord.ready} state={live.discord.state} />
              </div>
              <p>Mention Threadlight in the demo thread to request a Scripture-backed response.</p>
              <div className="live-actions">
                {live.discord.inviteUrl && (
                  <a
                    className="primary"
                    href={live.discord.inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join Discord <ExternalLink size={15} />
                  </a>
                )}
                {live.discord.openUrl && (
                  <a
                    className="text-button"
                    href={live.discord.openUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open demo thread <ExternalLink size={14} />
                  </a>
                )}
              </div>
              {!live.discord.inviteUrl && (
                <small className="connection-note">Public server invite is being configured.</small>
              )}
              {live.discord.widgetUrl && (
                <iframe
                  className="discord-widget"
                  title="Live Tapestry Discord server"
                  src={live.discord.widgetUrl}
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                />
              )}
            </article>
            <article className="live-destination">
              <div className="live-destination-title">
                <span className="route-icon">
                  <Video size={20} />
                </span>
                <div>
                  <strong>{live.youtube.channelName ?? live.youtube.name}</strong>
                  <small>{live.youtube.replyPolicy ?? "Not configured"}</small>
                </div>
                <LiveState ready={live.youtube.ready} state={live.youtube.state} />
              </div>
              <p>Comment on the selected video. Threadlight watches only the videos shown here.</p>
              {live.youtube.selectedVideos.map((video) => (
                <a
                  className="live-video"
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  key={video.url}
                >
                  {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" />}
                  <span>
                    <strong>{video.title}</strong>
                    <small>Open on YouTube</small>
                  </span>
                  <ExternalLink size={15} />
                </a>
              ))}
              <small className="connection-note">
                {live.youtube.replyCount}/{live.youtube.dailyReplyLimit ?? 0} replies today
                {live.youtube.lastPollAt
                  ? ` · Last checked ${new Date(live.youtube.lastPollAt).toLocaleTimeString()}`
                  : ""}
              </small>
            </article>
          </div>
          {errors.length > 0 && (
            <div className="live-errors" role="status">
              <MessageSquareWarning size={17} />
              <div>
                <strong>Needs attention</strong>
                {errors.slice(0, 3).map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </div>
          )}
          {errors.length === 0 && (
            <div className="healthy-state" role="status">
              <CheckCircle2 size={17} />
              All configured connectors are healthy.
            </div>
          )}
          <div className="activity-heading">
            <div>
              <h3>Recent activity</h3>
              <p>Observed messages, responses, intentional skips, and connector errors.</p>
            </div>
            <small>Updated {new Date(live.generatedAt).toLocaleTimeString()}</small>
          </div>
          <fieldset className="activity-filters" aria-label="Filter recent activity">
            {(["all", "discord", "youtube", "errors"] as ActivityFilter[]).map((item) => (
              <button
                type="button"
                className={filter === item ? "selected" : ""}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
                key={item}
              >
                {item === "all" ? "All" : item[0]?.toUpperCase() + item.slice(1)}
                <span>{activityFilterCount(live.activity, item)}</span>
              </button>
            ))}
          </fieldset>
          <div className="activity-list">
            {filteredActivity.length === 0 && (
              <p className="activity-empty">
                {live.activity.length
                  ? "No activity matches this filter."
                  : "Waiting for the first live interaction."}
              </p>
            )}
            {filteredActivity.map((event) => (
              <article className={`activity-row ${event.status}`} key={event.id}>
                <span className="activity-source">
                  {event.source === "discord" ? <MessageCircle size={16} /> : <Video size={16} />}
                </span>
                <div>
                  <div className="activity-meta">
                    <strong>{activityLabel(event.status)}</strong>
                    <span>
                      {event.actor ? `${event.actor} · ` : ""}
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {event.input && <p>{event.input}</p>}
                  {event.output && <blockquote>{event.output}</blockquote>}
                  {event.reason && <small className="activity-reason">{event.reason}</small>}
                  {(event.reference || event.provider || event.durationMs !== undefined) && (
                    <small>
                      {[
                        event.reference,
                        event.provider,
                        event.durationMs && `${event.durationMs} ms`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                </div>
              </article>
            ))}
          </div>
          {live.youtube.recentComments.length > 0 && (
            <details className="youtube-history">
              <summary>Recent YouTube review history</summary>
              {live.youtube.recentComments.map((comment) => (
                <div
                  className="youtube-history-row"
                  key={`${comment.createdAt}-${comment.authorName}`}
                >
                  <strong>
                    {comment.authorName} · {comment.status}
                  </strong>
                  <p>{comment.commentText}</p>
                  <small>{comment.replyText}</small>
                  {comment.error && <small className="error-copy">{comment.error}</small>}
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}

function LiveState({ ready, state }: { ready: boolean; state: string }) {
  return <span className={`live-state ${ready ? "ready" : ""}`}>{ready ? "Live" : state}</span>;
}

function activityLabel(status: PublicLiveStatus["activity"][number]["status"]) {
  return {
    observed: "Message observed",
    queued: "Response queued",
    responded: "Response sent",
    drafted: "Reply drafted",
    posted: "Reply posted",
    skipped: "No response needed",
    error: "Connector error",
  }[status];
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const inputId = useId();
  return (
    <div className="field">
      <label htmlFor={inputId}>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </label>
      {isValidElement(children) ? cloneElement(children, { id: inputId }) : children}
    </div>
  );
}

function omitEmpty<T extends Record<string, string>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry.trim().length > 0),
  ) as Partial<T>;
}
