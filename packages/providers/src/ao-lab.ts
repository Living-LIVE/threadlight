import type { ScripturePassage, ScriptureProvider, ScriptureRequest } from "@threadlight/core";

type FetchLike = typeof fetch;

type AoFragment =
  | string
  | {
      text?: string;
      lineBreak?: boolean;
      noteId?: number;
      poem?: number;
    };

type AoResponse = {
  translation?: {
    name?: string;
    shortName?: string;
    englishName?: string;
    website?: string;
    licenseUrl?: string;
  };
  chapter?: {
    content?: Array<{
      type?: string;
      number?: number;
      content?: AoFragment[];
    }>;
  };
};

type AoLabOptions = {
  bibleId?: string;
  baseUrl?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
};

export class AoLabScriptureProvider implements ScriptureProvider {
  readonly id = "ao-lab";
  readonly #bibleId: string;
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(options: AoLabOptions = {}) {
    this.#bibleId = options.bibleId ?? "BSB";
    this.#baseUrl = options.baseUrl ?? "https://bible.helloao.org/api";
    this.#fetch = options.fetchFn ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? 12_000;
  }

  async getPassage(request: ScriptureRequest): Promise<ScripturePassage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await this.#fetch(
        `${this.#baseUrl}/${encodeURIComponent(this.#bibleId)}/${request.bookId}/${request.chapter}.json`,
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`AO Lab passage request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as AoResponse;
      const verseEnd = request.verseEnd ?? request.verseStart;
      const text = (payload.chapter?.content ?? [])
        .filter(
          (block) =>
            block.type === "verse" &&
            typeof block.number === "number" &&
            block.number >= request.verseStart &&
            block.number <= verseEnd,
        )
        .map((block) => fragmentsToText(block.content))
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!text) {
        throw new Error(`AO Lab returned no text for ${request.reference}`);
      }

      const translation = payload.translation;
      const translationCode =
        translation?.shortName ?? translation?.englishName ?? translation?.name ?? this.#bibleId;
      const attributionName = translation?.englishName ?? translation?.name ?? translationCode;

      return {
        reference: request.reference,
        text,
        translation: translationCode,
        attribution: `${attributionName} · Scripture text via AO Lab`,
        sourceUrl: translation?.website ?? "https://bible.helloao.org/",
        copyright: translation?.licenseUrl,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function fragmentsToText(fragments: AoFragment[] | undefined) {
  if (!fragments) return "";
  return fragments
    .map((fragment) => {
      if (typeof fragment === "string") return fragment;
      if (fragment.text) return fragment.text;
      return fragment.lineBreak ? "\n" : "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
