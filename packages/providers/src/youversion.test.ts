import { describe, expect, it, vi } from "vitest";
import { YouVersionScriptureProvider } from "./youversion.js";

describe("YouVersionScriptureProvider", () => {
  it("fetches each requested verse with the App Key and preserves attribution", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          id: 3034,
          abbreviation: "BSB",
          title: "Berean Standard Bible",
          copyright: "Public domain.",
          youversion_deep_link: "https://www.bible.com/versions/3034",
        }),
      )
      .mockResolvedValueOnce(Response.json({ content: "The Lord is near." }))
      .mockResolvedValueOnce(Response.json({ content: "He saves the contrite." }));
    const provider = new YouVersionScriptureProvider({ appKey: "test-key", fetchFn });

    await expect(
      provider.getPassage({
        bookId: "PSA",
        chapter: 34,
        verseStart: 18,
        verseEnd: 19,
        reference: "Psalm 34:18-19",
      }),
    ).resolves.toMatchObject({
      text: "The Lord is near. He saves the contrite.",
      translation: "BSB",
      attribution: "Berean Standard Bible · Scripture text via YouVersion",
    });
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/bibles/3034/passages/PSA.34.18"),
      expect.objectContaining({
        headers: { Accept: "application/json", "X-YVP-App-Key": "test-key" },
      }),
    );
  });
});
