export type ActivityFilter = "all" | "discord" | "youtube" | "errors";

export type FilterableActivity = {
  source: "discord" | "youtube";
  status: string;
};

export function filterActivity<T extends FilterableActivity>(
  activity: T[],
  filter: ActivityFilter,
): T[] {
  if (filter === "all") return activity;
  if (filter === "errors") return activity.filter((event) => event.status === "error");
  return activity.filter((event) => event.source === filter);
}

export function activityFilterCount(
  activity: FilterableActivity[],
  filter: ActivityFilter,
): number {
  return filterActivity(activity, filter).length;
}
