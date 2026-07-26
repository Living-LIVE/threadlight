import type { ScripturePassage, ScriptureProvider, ScriptureRequest } from "@threadlight/core";

type YouVersionOptions = {
  appKey: string;
  bibleId?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type Bible = {
  id?: number;
  abbreviation?: string;
  title?: string;
  copyright?: string;
  promotional_content?: string;
  youversion_deep_link?: string;
};

export class YouVersionScriptureProvider implements ScriptureProvider {
  readonly id = "youversion";
  readonly #appKey: string;
  readonly #configuredBibleId: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  #bible?: Bible;

  constructor(options: YouVersionOptions) {
    this.#appKey = options.appKey;
    this.#configuredBibleId = options.bibleId ?? "3034";
    this.#baseUrl = options.baseUrl ?? "https://api.youversion.com/v1";
    this.#fetch = options.fetchFn ?? fetch;
  }

  async getPassage(request: ScriptureRequest): Promise<ScripturePassage> {
    const bible = await this.bible();
    const verseEnd = request.verseEnd ?? request.verseStart;
    const passages = await Promise.all(
      Array.from({ length: verseEnd - request.verseStart + 1 }, (_, index) =>
        this.request<{ content?: string; reference?: string }>(
          `/bibles/${required(bible.id, "Bible ID")}/passages/${request.bookId}.${request.chapter}.${request.verseStart + index}?format=text&include_headings=false&include_notes=false`,
        ),
      ),
    );
    const text = passages
      .map((passage) => passage.content?.replace(/\s+/g, " ").trim())
      .filter((content): content is string => Boolean(content))
      .join(" ");
    if (!text) throw new Error(`YouVersion returned no text for ${request.reference}`);
    const translation = bible.abbreviation ?? String(bible.id);
    return {
      reference: request.reference,
      text,
      translation,
      attribution: `${bible.title ?? translation} · Scripture text via YouVersion`,
      sourceUrl:
        bible.youversion_deep_link ??
        `https://www.bible.com/bible/${bible.id}/${request.bookId}.${request.chapter}.${request.verseStart}`,
      ...(bible.copyright ? { copyright: bible.copyright } : {}),
    };
  }

  private async bible() {
    if (this.#bible) return this.#bible;
    if (/^\d+$/.test(this.#configuredBibleId)) {
      this.#bible = await this.request<Bible>(`/bibles/${this.#configuredBibleId}`);
      return this.#bible;
    }
    const payload = await this.request<{ data?: Bible[] }>(
      `/bibles?language_ranges[]=en&page_size=99`,
    );
    const abbreviation = this.#configuredBibleId.toUpperCase();
    const bible = payload.data?.find((item) => item.abbreviation?.toUpperCase() === abbreviation);
    if (!bible?.id) throw new Error(`YouVersion Bible ${this.#configuredBibleId} is unavailable.`);
    this.#bible = bible;
    return bible;
  }

  private async request<T>(path: string) {
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      headers: { Accept: "application/json", "X-YVP-App-Key": this.#appKey },
    });
    const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok) {
      throw new Error(
        payload.message ?? `YouVersion request failed with status ${response.status}`,
      );
    }
    return payload;
  }
}

function required(value: number | undefined, name: string) {
  if (value === undefined) throw new Error(`${name} is missing from the YouVersion response.`);
  return value;
}
