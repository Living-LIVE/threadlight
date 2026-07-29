import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ActivitySource = "discord" | "youtube";
export type ActivityStatus =
  | "observed"
  | "queued"
  | "responded"
  | "drafted"
  | "posted"
  | "skipped"
  | "error";

export type ActivityInput = {
  source: ActivitySource;
  status: ActivityStatus;
  sourceId?: string;
  actor?: string;
  input?: string;
  output?: string;
  reason?: string;
  destination?: string;
  reference?: string;
  provider?: string;
  durationMs?: number;
};

export type ActivityEvent = ActivityInput & {
  id: string;
  createdAt: string;
};

export interface ActivityRecorder {
  record(input: ActivityInput): Promise<void>;
}

export class ActivityStore implements ActivityRecorder {
  private current?: ActivityEvent[];
  private writeQueue = Promise.resolve();

  public constructor(
    private readonly path: string,
    private readonly maxEvents = 200,
  ) {}

  public async record(input: ActivityInput): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const events = await this.load();
      const event = normalizeEvent(input);
      this.current = [...events, event].slice(-this.maxEvents);
      await this.persist(this.current);
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  public async list(limit = 50): Promise<ActivityEvent[]> {
    await this.writeQueue;
    return (await this.load()).slice(-Math.max(1, Math.min(limit, this.maxEvents))).reverse();
  }

  private async load(): Promise<ActivityEvent[]> {
    if (this.current) return this.current;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8"));
      this.current = Array.isArray(parsed)
        ? (parsed as ActivityEvent[]).slice(-this.maxEvents)
        : [];
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      this.current = [];
    }
    return this.current;
  }

  private async persist(events: ActivityEvent[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }
}

function normalizeEvent(input: ActivityInput): ActivityEvent {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: input.source,
    status: input.status,
    ...(input.sourceId ? { sourceId: clean(input.sourceId, 180) } : {}),
    ...(input.actor ? { actor: clean(input.actor, 120) } : {}),
    ...(input.input ? { input: clean(input.input, 500) } : {}),
    ...(input.output ? { output: clean(input.output, 1_000) } : {}),
    ...(input.reason ? { reason: clean(input.reason, 300) } : {}),
    ...(input.destination ? { destination: clean(input.destination, 180) } : {}),
    ...(input.reference ? { reference: clean(input.reference, 180) } : {}),
    ...(input.provider ? { provider: clean(input.provider, 180) } : {}),
    ...(input.durationMs === undefined
      ? {}
      : { durationMs: Math.max(0, Math.round(input.durationMs)) }),
  };
}

function clean(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
