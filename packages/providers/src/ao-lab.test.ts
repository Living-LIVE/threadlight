import { describe, expect, it, vi } from "vitest";
import { AoLabScriptureProvider } from "./ao-lab.js";

describe("AoLabScriptureProvider", () => {
  it("extracts the requested verse range and attribution", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          translation: {
            name: "Berean Standard Bible",
            shortName: "BSB",
            website: "https://example.test/bible",
          },
          chapter: {
            content: [
              { type: "verse", number: 17, content: ["Before"] },
              {
                type: "verse",
                number: 18,
                content: [
                  { text: "The Lord is near to the brokenhearted;", poem: 1 },
                  { text: "He saves the contrite in spirit.", poem: 2 },
                ],
              },
              { type: "verse", number: 19, content: ["After"] },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const provider = new AoLabScriptureProvider({ fetchFn });

    const passage = await provider.getPassage({
      bookId: "PSA",
      chapter: 34,
      verseStart: 18,
      verseEnd: null,
      reference: "Psalm 34:18",
    });

    expect(passage.text).toBe(
      "The Lord is near to the brokenhearted; He saves the contrite in spirit.",
    );
    expect(passage.translation).toBe("BSB");
    expect(passage.attribution).toBe("Berean Standard Bible · Scripture text via AO Lab");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://bible.helloao.org/api/BSB/PSA/34.json",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });
});
