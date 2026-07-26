import { describe, expect, it } from "vitest";
import { canLaunchSelectedProvider } from "./launch-readiness.js";

describe("canLaunchSelectedProvider", () => {
  it("requires an OpenAI credential unless OpenAI is already configured", () => {
    expect(
      canLaunchSelectedProvider({ provider: "openai", alreadyConfigured: false, credential: "" }),
    ).toBe(false);
    expect(
      canLaunchSelectedProvider({
        provider: "openai",
        alreadyConfigured: false,
        credential: "local-key",
      }),
    ).toBe(true);
    expect(
      canLaunchSelectedProvider({ provider: "openai", alreadyConfigured: true, credential: "" }),
    ).toBe(true);
  });

  it("requires both Gloo credentials unless Gloo is already configured", () => {
    expect(
      canLaunchSelectedProvider({
        provider: "gloo",
        alreadyConfigured: false,
        identity: "client-id",
        credential: "",
      }),
    ).toBe(false);
    expect(
      canLaunchSelectedProvider({
        provider: "gloo",
        alreadyConfigured: false,
        identity: "client-id",
        credential: "client-secret",
      }),
    ).toBe(true);
    expect(
      canLaunchSelectedProvider({ provider: "gloo", alreadyConfigured: true, credential: "" }),
    ).toBe(true);
  });

  it("does not falsely enable launch for saved-but-uninstalled adapters", () => {
    for (const provider of ["gemini", "bonfire"] as const) {
      expect(
        canLaunchSelectedProvider({
          provider,
          alreadyConfigured: true,
          credential: "local-credential",
        }),
      ).toBe(false);
    }
  });
});
