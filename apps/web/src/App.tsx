import {
  ArrowRight,
  CircleAlert,
  CirclePause,
  ExternalLink,
  Flame,
  LockKeyhole,
  MessageCircle,
  Play,
  Radio,
  Settings2,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import {
  cloneElement,
  type FormEvent,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { canLaunchSelectedProvider } from "./launch-readiness.js";
import { resolveStartupRoute } from "./startup-route.js";
import { runYouTubeAction } from "./youtube-action.js";

type DestinationKind = "discord" | "slack" | "youtube-comments" | "teams" | "twitch";
type Mode = "shy" | "medium" | "high";
type Provider = "openai" | "gemini" | "gloo" | "bonfire";

const participationModeLabels: Record<Mode, string> = {
  shy: "Prompted",
  medium: "Attentive",
  high: "Active",
};

type Deployment = {
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

type ControlStatus = {
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${url}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new Error(body?.message ?? "Threadlight could not save that change.");
  }
  return (await response.json()) as T;
}

export function App() {
  const [status, setStatus] = useState<ControlStatus>();
  const [screen, setScreen] = useState<"home" | "choose" | "connect" | "launch" | "settings">(
    "choose",
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await request<ControlStatus>("/api/control/status");
    setStatus(next);
    return next;
  }, []);

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
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to reach Threadlight."),
      );
  }, [refresh]);

  const selected = useMemo(
    () => status?.configuration.deployments.find((deployment) => deployment.id === selectedId),
    [selectedId, status],
  );

  const createDeployment = async (kind: DestinationKind) => {
    setBusy(true);
    setError(undefined);
    try {
      const created = await request<{ id: string }>("/api/control/deployments", {
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
    <main className="app-shell">
      <Header onSettings={() => setScreen("settings")} />
      {error && <Notice text={error} />}
      {screen === "choose" && (
        <ChooseDestination catalog={status.catalog} busy={busy} onChoose={createDeployment} />
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
          initialProvider={status.configuration.providers.ai}
          initialScripture={status.configuration.providers.scripture}
          onBack={() => setScreen("connect")}
          onLaunched={async () => {
            await refresh();
            setScreen("home");
          }}
          onError={setError}
        />
      )}
      {screen === "home" && (
        <LiveDashboard
          status={status}
          onAdd={() => {
            setSelectedId(undefined);
            setScreen("choose");
          }}
          onOpen={openDeployment}
          onPause={async (id) => {
            try {
              await request(`/api/control/deployments/${id}/pause`, { method: "POST" });
              await refresh();
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
          }}
          onError={setError}
        />
      )}
    </main>
  );
}

function Header({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <Flame size={19} />
        <span>Threadlight</span>
      </div>
      <div className="topbar-actions">
        <span className="local-state">
          <i />
          Local control
        </span>
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Settings">
          <Settings2 size={18} />
        </button>
      </div>
    </header>
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

function Notice({ text }: { text: string }) {
  return (
    <div className="notice" role="alert">
      <CircleAlert size={16} />
      {text}
    </div>
  );
}

function ChooseDestination({
  catalog,
  busy,
  onChoose,
}: {
  catalog: ControlStatus["catalog"];
  busy: boolean;
  onChoose: (kind: DestinationKind) => void;
}) {
  return (
    <section className="wizard narrow">
      <p className="step">Step 1 of 3</p>
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
              ) : (
                <ArrowRight size={18} />
              )}
            </button>
          );
        })}
      </section>
      <p className="local-note">
        <LockKeyhole size={15} />
        Keys and settings stay in your local Threadlight volume.
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
  const [form, setForm] = useState({ applicationId: "", botToken: "", guildId: "", channelId: "" });
  const [saving, setSaving] = useState(false);
  const saved = deployment.discord;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      await request(`/api/control/deployments/${deployment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ discord: omitEmpty(form) }),
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
      <p className="step">Step 2 of 3</p>
      <p className="eyebrow">Connect Discord</p>
      <h1>Choose where Threadlight listens.</h1>
      <p className="lede">
        Use the application and bot you created in Discord. These values never leave this machine.
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
              saved?.applicationIdConfigured ? "Already configured" : "123456789012345678"
            }
          />
        </Field>
        <Field
          label="Bot token"
          hint={saved?.botTokenConfigured ? "Saved locally" : "From the Bot page"}
        >
          <input
            value={form.botToken}
            onChange={(event) => setForm({ ...form, botToken: event.target.value })}
            type="password"
            placeholder={saved?.botTokenConfigured ? "Already configured" : "Paste bot token"}
          />
        </Field>
        <div className="field-grid">
          <Field label="Server ID">
            <input
              value={form.guildId}
              onChange={(event) => setForm({ ...form, guildId: event.target.value })}
              placeholder={saved?.guildIdConfigured ? "Already configured" : "Discord server ID"}
            />
          </Field>
          <Field label="Channel ID">
            <input
              value={form.channelId}
              onChange={(event) => setForm({ ...form, channelId: event.target.value })}
              placeholder={saved?.channelIdConfigured ? "Already configured" : "Discord channel ID"}
            />
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
          <button type="submit" className="primary" disabled={saving}>
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
  const saved = deployment.youtube;
  const [replyMode, setReplyMode] = useState(saved?.replyMode ?? "review");
  const [pollSeconds, setPollSeconds] = useState(String(saved?.pollSeconds ?? 180));
  const [dailyReplyLimit, setDailyReplyLimit] = useState(String(saved?.dailyReplyLimit ?? 12));
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
    setVideosLoading(true);
    void request<{ videos: Array<{ id: string; title: string; thumbnailUrl?: string }> }>(
      `/api/control/deployments/${deployment.id}/youtube/videos`,
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
  }, [connected, deployment.id, onError]);
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
      <p className="step">YouTube Comments</p>
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
            <ExternalLink size={14} /> Connected to {saved?.channelName ?? "your YouTube channel"}
          </p>
          <Field
            label="Videos to watch"
            hint="Choose up to 10 videos. Threadlight ignores comments on every other video."
          >
            <div className="video-list">
              {videosLoading && <small>Loading your recent videos...</small>}
              {!videosLoading && videos.length === 0 && (
                <small>No videos were found for this channel.</small>
              )}
              {videos.map((video) => {
                const checked = selectedVideoIds.has(video.id);
                return (
                  <label className="video-option" key={video.id}>
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
      <p className="step">Step 2 of 3</p>
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
  initialProvider,
  initialScripture,
  onBack,
  onLaunched,
  onError,
}: {
  deployment: Deployment;
  initialProvider: ControlStatus["configuration"]["providers"]["ai"];
  initialScripture: ControlStatus["configuration"]["providers"]["scripture"];
  onBack: () => void;
  onLaunched: () => Promise<void>;
  onError: (value: string) => void;
}) {
  const [provider, setProvider] = useState<Provider>(initialProvider.provider);
  const [model, setModel] = useState(initialProvider.model);
  const [apiKey, setApiKey] = useState("");
  const [providerIdentity, setProviderIdentity] = useState("");
  const [mode, setMode] = useState<Mode>(deployment.discord?.participationMode ?? "shy");
  const [saving, setSaving] = useState(false);
  const providerAlreadyConfigured =
    initialProvider.configured && provider === initialProvider.provider;
  const providerReady = canLaunchSelectedProvider({
    provider,
    alreadyConfigured: providerAlreadyConfigured,
    credential: apiKey,
  });
  const launch = async () => {
    setSaving(true);
    onError("");
    try {
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
    <section className="wizard form-wizard">
      <p className="step">Step 3 of 3</p>
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
              onClick={() => setProvider(item)}
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
        {provider !== "openai" && (
          <p className="status-note">
            This provider can be saved now; its live runtime adapter is still being added.
          </p>
        )}
        <div className="field-grid">
          <Field label="Model">
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Model name"
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
          <Field
            label={provider === "gloo" ? "Gloo client secret" : "Provider credential"}
            hint={
              initialProvider.configured && provider === initialProvider.provider
                ? "A credential is already saved locally"
                : undefined
            }
          >
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder="Paste credential"
            />
          </Field>
        </div>
      </section>
      <div className="form-actions">
        <button type="button" className="text-button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || !providerReady}
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
    </section>
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
  const [provider, setProvider] = useState<Provider>(initialProvider.provider);
  const [model, setModel] = useState(initialProvider.model);
  const [credential, setCredential] = useState("");
  const [providerIdentity, setProviderIdentity] = useState("");
  const [scripture, setScripture] = useState(initialScripture.provider);
  const [bibleId, setBibleId] = useState(initialScripture.bibleId);
  const [scriptureCredential, setScriptureCredential] = useState("");
  const [saving, setSaving] = useState(false);
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
              onClick={() => setProvider(item)}
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
        <Field label="Bible ID">
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
  onAdd,
  onOpen,
  onPause,
}: {
  status: ControlStatus;
  onAdd: () => void;
  onOpen: (deployment: Deployment) => void;
  onPause: (id: string) => Promise<void>;
}) {
  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Local control</p>
          <h1>Threadlight</h1>
          <p className="lede">Your deployments stay on this machine.</p>
        </div>
        <button className="primary" type="button" onClick={onAdd}>
          Add destination <ArrowRight size={17} />
        </button>
      </div>
      <section className="deployment-list">
        <div className="list-title">
          <h2>Destinations</h2>
          <span>{status.configuration.deployments.length}</span>
        </div>
        {status.configuration.deployments.map((deployment) => {
          const runtime = status.runtime.deployments.find((entry) => entry?.id === deployment.id);
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
      <div className="dashboard-foot">
        <LockKeyhole size={15} />
        Configuration is stored in your local Threadlight volume.
      </div>
    </section>
  );
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
