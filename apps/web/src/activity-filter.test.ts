import { describe, expect, it } from "vitest";
import { activityFilterCount, filterActivity } from "./activity-filter.js";

const activity = [
  { id: "1", source: "discord" as const, status: "responded" },
  { id: "2", source: "youtube" as const, status: "drafted" },
  { id: "3", source: "discord" as const, status: "error" },
];

describe("activity filters", () => {
  it("filters by connector and error status without changing event order", () => {
    expect(filterActivity(activity, "discord").map((event) => event.id)).toEqual(["1", "3"]);
    expect(filterActivity(activity, "youtube").map((event) => event.id)).toEqual(["2"]);
    expect(filterActivity(activity, "errors").map((event) => event.id)).toEqual(["3"]);
    expect(activityFilterCount(activity, "all")).toBe(3);
  });
});
