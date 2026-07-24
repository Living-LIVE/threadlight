import { describe, expect, it } from "vitest";
import { assessImmediateSafety, sanitizePublicText } from "./safety.js";

describe("Threadlight safety", () => {
  it("detects immediate-harm language deterministically", () => {
    expect(assessImmediateSafety("I do not want to live anymore").riskLevel).toBe("urgent");
  });

  it("prevents generated mass mentions", () => {
    expect(sanitizePublicText("@everyone please read <@&123>")).toBe(
      "everyone please read a community role",
    );
  });
});
