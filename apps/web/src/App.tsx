import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  HeartHandshake,
  Info,
  LoaderCircle,
  MessageCircle,
  Mic,
  MoreHorizontal,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type Author = {
  id: string;
  name: string;
  avatarUrl?: string;
  isAgent?: boolean;
};

type ChatMessage = {
  id: string;
  author: Author;
  content: string;
  createdAt: string;
  displayTime?: string;
};

type Passage = {
  reference: string;
  text: string;
  translation: string;
  attribution: string;
  sourceUrl?: string;
};

type ResponseData = {
  reply: {
    id: string;
    message: string;
    passage?: Passage;
    prayerPrompt?: string;
    carePrompt?: string;
  };
  decision: {
    action: string;
    riskLevel: string;
    reason: string;
  };
  trace: {
    id: string;
    aiProvider: string;
    scriptureProvider: string;
    totalMs: number;
    steps: Array<{ name: string; durationMs: number; status: string }>;
  };
};

type Scenario = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  messages: ChatMessage[];
  prompt: string;
  fixture: ResponseData;
};

const AGENT: Author = { id: "threadlight", name: "Threadlight", isAgent: true };

const makeMessage = (
  id: string,
  author: Author,
  content: string,
  displayTime: string,
): ChatMessage => ({
  id,
  author,
  content,
  createdAt: displayTime === "now" ? new Date().toISOString() : demoTimeToIso(displayTime),
  displayTime,
});

function demoTimeToIso(displayTime: string): string {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(displayTime);
  if (!match) throw new Error(`Invalid demo time: ${displayTime}`);
  const [, rawHour, minute, period] = match;
  let hour = Number(rawHour) % 12;
  if (period === "PM") hour += 12;
  return `2026-07-24T${String(hour).padStart(2, "0")}:${minute}:00.000Z`;
}

const baseTrace = (id: string, totalMs: number): ResponseData["trace"] => ({
  id,
  aiProvider: "OpenAI demo fallback",
  scriptureProvider: "AO Lab BSB demo fallback",
  totalMs,
  steps: [
    { name: "Read the room", durationMs: 218, status: "complete" },
    { name: "Discern a response", durationMs: 531, status: "complete" },
    { name: "Ground in Scripture", durationMs: 764, status: "complete" },
  ],
});

const bundledScenarios: [Scenario, ...Scenario[]] = [
  {
    id: "grief",
    label: "Grief",
    description: "When a room is carrying loss",
    icon: HeartHandshake,
    prompt: "What might help this room hold space for grief?",
    messages: [
      makeMessage(
        "grief-1",
        { id: "maya", name: "Maya" },
        "We got the call this morning. Grandma is gone.",
        "8:41 PM",
      ),
      makeMessage(
        "grief-2",
        { id: "eli", name: "Eli" },
        "I don't know what to say, but I'm here with you.",
        "8:43 PM",
      ),
      makeMessage(
        "grief-3",
        { id: "maya", name: "Maya" },
        "Thank you. It still doesn't feel real.",
        "8:44 PM",
      ),
    ],
    fixture: {
      reply: {
        id: "grief-reply",
        message:
          "This room already has the right instinct: presence before answers. Grief does not need to be tidied up tonight. You can stay close, name the loss, and let the quiet be part of the care.",
        passage: {
          reference: "Psalm 34:18",
          text: "The LORD is near to the brokenhearted; He saves the contrite in spirit.",
          translation: "BSB",
          attribution: "Berean Standard Bible · Scripture text via AO Lab",
          sourceUrl: "https://berean.bible/",
        },
        carePrompt: "What would it look like to simply stay with Maya for the next few minutes?",
      },
      decision: {
        action: "respond with presence",
        riskLevel: "normal",
        reason: "The room is asking for companionship, not a solution.",
      },
      trace: baseTrace("trace-grief-4c2", 1513),
    },
  },
  {
    id: "conflict",
    label: "Conflict",
    description: "When the room needs a slower pace",
    icon: MessageCircle,
    prompt: "How can this conversation move toward repair?",
    messages: [
      makeMessage(
        "conflict-1",
        { id: "jordan", name: "Jordan" },
        "I felt dismissed in that meeting, and I am still carrying it.",
        "7:18 PM",
      ),
      makeMessage(
        "conflict-2",
        { id: "sam", name: "Sam" },
        "That wasn't my intent. I thought we were just moving quickly.",
        "7:20 PM",
      ),
      makeMessage(
        "conflict-3",
        { id: "jordan", name: "Jordan" },
        "I hear that, but the impact was real for me.",
        "7:21 PM",
      ),
    ],
    fixture: {
      reply: {
        id: "conflict-reply",
        message:
          "There is room here for intent and impact to be named without one canceling the other. A next step could be to reflect back what was heard before defending what was meant.",
        passage: {
          reference: "James 1:19",
          text: "My beloved brothers, understand this: Everyone should be quick to listen, slow to speak, and slow to anger.",
          translation: "BSB",
          attribution: "Berean Standard Bible · Scripture text via AO Lab",
          sourceUrl: "https://berean.bible/",
        },
        carePrompt: "What would Jordan need to hear reflected back before the room moves on?",
      },
      decision: {
        action: "make space to listen",
        riskLevel: "normal",
        reason: "The conversation can continue safely if listening comes before resolution.",
      },
      trace: baseTrace("trace-conflict-82a", 1698),
    },
  },
  {
    id: "encouragement",
    label: "Encouragement",
    description: "When someone needs a steady word",
    icon: Sparkles,
    prompt: "What steady word could this room offer?",
    messages: [
      makeMessage(
        "encourage-1",
        { id: "noah", name: "Noah" },
        "The interview went badly. I think I blew my only chance.",
        "6:03 PM",
      ),
      makeMessage(
        "encourage-2",
        { id: "ruth", name: "Ruth" },
        "One hard hour does not get to name your whole story.",
        "6:05 PM",
      ),
    ],
    fixture: {
      reply: {
        id: "encourage-reply",
        message:
          "The care already moving through this room is specific and grounded. Encouragement can tell the truth about the hard moment while refusing to make it the final word.",
        passage: {
          reference: "Galatians 6:9",
          text: "Let us not grow weary in well-doing, for in due time we will reap a harvest if we do not give up.",
          translation: "BSB",
          attribution: "Berean Standard Bible · Scripture text via AO Lab",
          sourceUrl: "https://berean.bible/",
        },
        carePrompt: "What is one true thing about Noah that is still true after this interview?",
      },
      decision: {
        action: "offer encouragement",
        riskLevel: "normal",
        reason: "The room is already offering grounded support and can reinforce it.",
      },
      trace: baseTrace("trace-encourage-31f", 1442),
    },
  },
  {
    id: "prayer",
    label: "Prayer",
    description: "When the room wants to turn toward God",
    icon: BookOpen,
    prompt: "Could this room pray together?",
    messages: [
      makeMessage(
        "prayer-1",
        { id: "ada", name: "Ada" },
        "Could we pause and pray for the families affected by the storm?",
        "5:36 PM",
      ),
      makeMessage(
        "prayer-2",
        { id: "leo", name: "Leo" },
        "Yes. I have a friend in the north side who lost power.",
        "5:38 PM",
      ),
    ],
    fixture: {
      reply: {
        id: "prayer-reply",
        message:
          "A simple prayer can hold the people you know and the people you do not. Begin with what is present: shelter for those without it, courage for responders, and care that reaches the isolated.",
        passage: {
          reference: "Philippians 4:6",
          text: "Be anxious for nothing, but in everything, by prayer and petition, with thanksgiving, present your requests to God.",
          translation: "BSB",
          attribution: "Berean Standard Bible · Scripture text via AO Lab",
          sourceUrl: "https://berean.bible/",
        },
        prayerPrompt:
          "God, be near to the families without power tonight. Give wisdom to those offering help, and make our care practical. Amen.",
      },
      decision: {
        action: "offer a prayer",
        riskLevel: "normal",
        reason: "The room explicitly asked to pray and named a concrete need.",
      },
      trace: baseTrace("trace-prayer-74b", 1586),
    },
  },
];

const defaultScenario = bundledScenarios[0];
if (!defaultScenario) throw new Error("Threadlight fixture scenarios are missing");
const defaultResponse = defaultScenario.fixture;

function normalizeScenario(value: unknown, index: number): Scenario | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id : `scenario-${index}`;
  const label =
    typeof source.label === "string"
      ? source.label
      : typeof source.name === "string"
        ? source.name
        : id;
  const description =
    typeof source.description === "string" ? source.description : "A shared room moment";
  const fallback =
    bundledScenarios.find((scenario) => scenario.id === id) ??
    bundledScenarios[index % bundledScenarios.length] ??
    defaultScenario;
  return { ...fallback, id, label, description };
}

async function loadScenarios(): Promise<{ scenarios: Scenario[]; usedFallback: boolean }> {
  try {
    const response = await fetch("/api/demo/scenarios");
    if (!response.ok) throw new Error(`Scenario request failed with ${response.status}`);
    const body = (await response.json()) as { scenarios?: unknown };
    const scenarios = Array.isArray(body.scenarios)
      ? body.scenarios
          .map(normalizeScenario)
          .filter((scenario): scenario is Scenario => scenario !== null)
      : [];
    if (scenarios.length === 0) throw new Error("No scenarios returned");
    return { scenarios, usedFallback: false };
  } catch {
    return { scenarios: bundledScenarios, usedFallback: true };
  }
}

async function requestResponse(
  scenario: Scenario,
  messages: ChatMessage[],
  prompt: string,
): Promise<{ data: ResponseData; usedFallback: boolean }> {
  try {
    const response = await fetch("/api/demo/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: scenario.id, messages, prompt }),
    });
    if (!response.ok) throw new Error(`Response request failed with ${response.status}`);
    const data = (await response.json()) as ResponseData;
    if (!data.reply?.message || !data.decision || !data.trace)
      throw new Error("Response contract was incomplete");
    return { data, usedFallback: false };
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    return { data: scenario.fixture, usedFallback: true };
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ author, size = "normal" }: { author: Author; size?: "normal" | "small" }) {
  return (
    <div
      className={`avatar avatar-${size} ${author.isAgent ? "avatar-agent" : ""}`}
      aria-hidden="true"
    >
      {author.avatarUrl ? (
        <img src={author.avatarUrl} alt="" />
      ) : author.isAgent ? (
        <Sparkles size={size === "small" ? 13 : 16} />
      ) : (
        initials(author.name)
      )}
    </div>
  );
}

function StatusDot({ tone = "live" }: { tone?: "live" | "muted" | "warn" }) {
  return <span className={`status-dot status-dot-${tone}`} aria-hidden="true" />;
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(bundledScenarios);
  const [scenarioId, setScenarioId] = useState("grief");
  const [messages, setMessages] = useState<ChatMessage[]>(defaultScenario.messages);
  const [response, setResponse] = useState<ResponseData | null>(defaultResponse);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [scenarioError, setScenarioError] = useState(false);
  const [responseError, setResponseError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(true);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [showProvenance, setShowProvenance] = useState(false);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === scenarioId) ?? defaultScenario,
    [scenarioId, scenarios],
  );

  useEffect(() => {
    let active = true;
    loadScenarios()
      .then((result) => {
        if (!active) return;
        setScenarios(result.scenarios);
        setUsingFallback(result.usedFallback);
        setScenarioError(false);
        setIsLoadingScenarios(false);
      })
      .catch(() => {
        if (!active) return;
        setScenarioError(true);
        setIsLoadingScenarios(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const selectScenario = (nextId: string) => {
    const nextScenario =
      scenarios.find((scenario) => scenario.id === nextId) ??
      bundledScenarios.find((scenario) => scenario.id === nextId) ??
      defaultScenario;
    setScenarioId(nextScenario.id);
    setMessages(nextScenario.messages);
    setResponse(nextScenario.fixture);
    setPrompt("");
    setResponseError(false);
    setShowProvenance(false);
  };

  const sendPrompt = async (event?: FormEvent) => {
    event?.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isLoading) return;
    const userMessage = makeMessage(
      `local-${Date.now()}`,
      { id: "you", name: "You" },
      nextPrompt,
      "now",
    );
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setPrompt("");
    setIsLoading(true);
    setResponseError(false);
    setShowProvenance(false);
    try {
      const result = await requestResponse(selectedScenario, nextMessages, nextPrompt);
      setResponse(result.data);
      setUsingFallback(result.usedFallback);
    } catch {
      setResponseError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Sparkles size={16} />
          </div>
          <span className="brand-name">Threadlight</span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="room-label">Wednesday night room</span>
        </div>
        <div className="topbar-actions">
          <div className="connection-status" role="status">
            {isOffline ? <WifiOff size={14} /> : <StatusDot />}
            <span>{isOffline ? "Offline" : usingFallback ? "Demo mode" : "Connected"}</span>
          </div>
          <IconButton label="Room settings">
            <Settings2 size={17} />
          </IconButton>
          <IconButton label="More room actions">
            <MoreHorizontal size={18} />
          </IconButton>
        </div>
      </header>

      {isOffline && (
        <div className="offline-banner" role="status">
          <WifiOff size={15} />
          <span>You are offline. Saved room scenarios are still available.</span>
        </div>
      )}

      <main className="room-layout">
        <section className="stage-column" aria-label="Live room visual">
          <div className="live-stage">
            <img
              className="room-image"
              src="/threadlight-room.png"
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div className="stage-fallback" aria-hidden="true">
              <div className="fallback-window fallback-window-one" />
              <div className="fallback-window fallback-window-two" />
              <div className="fallback-lamp" />
              <div className="fallback-table" />
              <div className="fallback-bible">
                <BookOpen size={26} />
              </div>
            </div>
            <div className="stage-tint" />
            <div className="stage-topline">
              <span className="live-tag">
                <StatusDot /> LIVE
              </span>
              <span>18:42:16</span>
            </div>
            <div className="stage-caption">
              <div>
                <p className="eyebrow">COMMUNITY ROOM / 04</p>
                <h1>A little more room for one another.</h1>
              </div>
              <div className="stage-participants">
                <Users size={15} />
                <span>12 present</span>
              </div>
            </div>
            <div className="stage-controls">
              <div className="stage-control-group">
                <IconButton label="Toggle microphone">
                  <Mic size={16} />
                </IconButton>
                <IconButton label="Open room chat">
                  <MessageCircle size={16} />
                </IconButton>
              </div>
              <span className="stage-audio">
                <Activity size={14} /> room audio on
              </span>
            </div>
          </div>
          <div className="stage-meta">
            <div>
              <span className="meta-label">Room host</span>
              <strong>Ruth &amp; friends</strong>
            </div>
            <div>
              <span className="meta-label">Gathered since</span>
              <strong>8:00 PM</strong>
            </div>
            <div className="stage-meta-end">
              <span className="meta-label">Presence</span>
              <strong>
                <StatusDot /> 12 people
              </strong>
            </div>
          </div>
        </section>

        <section className="conversation-column" aria-label="Shared conversation">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SHARED CONVERSATION</p>
              <h2>Room chat</h2>
            </div>
            <IconButton label="Refresh room" onClick={() => selectScenario(scenarioId)}>
              <RefreshCw size={16} />
            </IconButton>
          </div>
          <fieldset className="scenario-selector">
            <legend className="sr-only">Choose a room moment</legend>
            <div className="selector-header">
              <span className="meta-label">Room moment</span>
              {isLoadingScenarios ? (
                <LoaderCircle className="spin" size={14} aria-label="Loading scenarios" />
              ) : (
                <span className="selector-count">{scenarios.length} available</span>
              )}
            </div>
            <div className="scenario-list" role="tablist" aria-label="Scenarios">
              {scenarios.map((scenario) => {
                const Icon = scenario.icon;
                return (
                  <button
                    key={scenario.id}
                    className={`scenario-tab ${scenario.id === scenarioId ? "selected" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={scenario.id === scenarioId}
                    onClick={() => selectScenario(scenario.id)}
                  >
                    <Icon size={15} />
                    <span>{scenario.label}</span>
                  </button>
                );
              })}
            </div>
            {scenarioError && (
              <p className="inline-error">
                <CircleAlert size={14} /> Could not load room moments.
              </p>
            )}
          </fieldset>
          <div className="chat-feed" aria-live="polite">
            {messages.length === 0 ? (
              <EmptyState onStart={() => selectScenario(scenarioId)} />
            ) : (
              messages.map((message) => <ChatMessageRow key={message.id} message={message} />)
            )}
            {isLoading && <LoadingMessage />}
          </div>
          <form className="composer" onSubmit={sendPrompt}>
            <label htmlFor="room-prompt" className="sr-only">
              Write to the room
            </label>
            <textarea
              id="room-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={selectedScenario.prompt}
              rows={2}
              disabled={isLoading}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendPrompt();
                }
              }}
            />
            <div className="composer-footer">
              <span className="composer-hint">
                Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line
              </span>
              <button
                className="send-button"
                type="submit"
                disabled={!prompt.trim() || isLoading}
                aria-label="Send message"
                title="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </section>

        <aside className="threadlight-column" aria-label="Threadlight response">
          <div className="agent-heading">
            <div className="agent-heading-icon">
              <Sparkles size={17} />
            </div>
            <div>
              <p className="eyebrow">THREADLIGHT</p>
              <h2>Room response</h2>
            </div>
            <span className="agent-live">
              <StatusDot /> listening
            </span>
          </div>
          {isLoading ? (
            <ResponseLoading />
          ) : responseError ? (
            <ResponseError
              onRetry={() => {
                setResponseError(false);
                setPrompt(selectedScenario.prompt);
              }}
            />
          ) : response ? (
            <ResponsePanel
              response={response}
              showProvenance={showProvenance}
              onToggleProvenance={() => setShowProvenance((value) => !value)}
            />
          ) : (
            <EmptyResponse />
          )}
          <div className="agent-boundary">
            <Info size={14} />
            <span>
              Threadlight offers a moment of discernment, not counseling or emergency care.
            </span>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ChatMessageRow({ message }: { message: ChatMessage }) {
  return (
    <article className={`chat-message ${message.author.id === "you" ? "is-you" : ""}`}>
      <Avatar author={message.author} />
      <div className="message-body">
        <div className="message-meta">
          <strong>{message.author.name}</strong>
          <span>{message.displayTime ?? formatMessageTime(message.createdAt)}</span>
        </div>
        <p>{message.content}</p>
      </div>
    </article>
  );
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function LoadingMessage() {
  return (
    <div className="loading-message" role="status">
      <Avatar author={AGENT} size="small" />
      <div className="loading-lines">
        <span />
        <span />
        <span />
      </div>
      <span className="loading-label">Listening…</span>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <MessageCircle size={20} />
      </div>
      <strong>This room is quiet.</strong>
      <p>Choose a room moment to bring the conversation back into view.</p>
      <button type="button" className="text-button" onClick={onStart}>
        Load room moment <ArrowUp size={14} />
      </button>
    </div>
  );
}

function ResponsePanel({
  response,
  showProvenance,
  onToggleProvenance,
}: {
  response: ResponseData;
  showProvenance: boolean;
  onToggleProvenance: () => void;
}) {
  const prompt = response.reply.carePrompt ?? response.reply.prayerPrompt;
  return (
    <div className="response-stack">
      <div className="response-intro">
        <Avatar author={AGENT} />
        <div>
          <strong>Here is what I notice.</strong>
          <span>Based on this room right now</span>
        </div>
      </div>
      <p className="response-message">{response.reply.message}</p>
      {response.reply.passage && (
        <div className="passage-block">
          <div className="passage-topline">
            <BookOpen size={15} />
            <span>Scripture for this moment</span>
            <a
              href={response.reply.passage.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${response.reply.passage.reference} source`}
            >
              <ArrowUp size={13} />
            </a>
          </div>
          <blockquote>“{response.reply.passage.text}”</blockquote>
          <div className="passage-attribution">
            <strong>{response.reply.passage.reference}</strong>
            <span>
              {response.reply.passage.translation} · {response.reply.passage.attribution}
            </span>
          </div>
        </div>
      )}
      {prompt && (
        <div className="care-prompt">
          <span className="prompt-label">
            <HeartHandshake size={14} /> A gentle next question
          </span>
          <p>{prompt}</p>
        </div>
      )}
      <div className="decision-row">
        <div>
          <span className="meta-label">Suggested action</span>
          <strong>{response.decision.action}</strong>
        </div>
        <span className="risk-badge">
          <Check size={13} /> {response.decision.riskLevel} risk
        </span>
      </div>
      <p className="decision-reason">{response.decision.reason}</p>
      <button
        className="provenance-toggle"
        type="button"
        aria-label={showProvenance ? "Hide response provenance" : "Show response provenance"}
        aria-expanded={showProvenance}
        onClick={onToggleProvenance}
      >
        <span>
          <Clock3 size={14} /> Response provenance
        </span>
        <ChevronDown className={showProvenance ? "rotated" : ""} size={15} />
      </button>
      {showProvenance && <Provenance trace={response.trace} />}
    </div>
  );
}

function Provenance({ trace }: { trace: ResponseData["trace"] }) {
  return (
    <section className="provenance" aria-label="Response provenance details">
      <div className="provenance-grid">
        <div>
          <span>Trace ID</span>
          <strong>{trace.id}</strong>
        </div>
        <div>
          <span>Total time</span>
          <strong>{trace.totalMs}ms</strong>
        </div>
      </div>
      <div className="provider-row">
        <span>AI provider</span>
        <strong>{trace.aiProvider}</strong>
      </div>
      <div className="provider-row">
        <span>Scripture provider</span>
        <strong>{trace.scriptureProvider}</strong>
      </div>
      <div className="trace-steps">
        {trace.steps.map((step) => (
          <div key={step.name} className="trace-step">
            <span>
              <StatusDot tone={step.status === "complete" ? "live" : "warn"} />
              {step.name}
            </span>
            <strong>{step.durationMs}ms</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResponseLoading() {
  return (
    <div className="response-loading" role="status">
      <div className="loading-orbit">
        <LoaderCircle className="spin" size={22} />
      </div>
      <strong>Listening to the room…</strong>
      <span>Finding a response that fits this moment.</span>
      <div className="response-skeleton">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function ResponseError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="response-error" role="alert">
      <CircleAlert size={21} />
      <strong>The response is taking a pause.</strong>
      <p>Try again when the room is ready.</p>
      <button className="text-button" type="button" onClick={onRetry}>
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  );
}

function EmptyResponse() {
  return (
    <div className="empty-response">
      <Sparkles size={19} />
      <strong>Threadlight is here when the room needs it.</strong>
    </div>
  );
}
