import { describe, expect, it } from "vitest";
import { defaultModelForProvider, modelAfterProviderChange } from "./provider-model.js";

describe("provider model selection", () => {
  it("replaces Gloo auto-routing when switching to OpenAI", () => {
    expect(modelAfterProviderChange("gloo", "auto", "openai")).toBe("gpt-4.1-mini");
  });

  it("uses each provider's default when switching adapters", () => {
    expect(modelAfterProviderChange("openai", "gpt-4.1-mini", "gemini")).toBe("gemini-2.5-flash");
    expect(modelAfterProviderChange("openai", "gpt-4.1-mini", "gloo")).toBe("auto");
    expect(defaultModelForProvider("bonfire")).toBe("auto");
  });

  it("preserves an operator-edited model when the provider does not change", () => {
    expect(modelAfterProviderChange("openai", "gpt-4.1", "openai")).toBe("gpt-4.1");
  });
});
