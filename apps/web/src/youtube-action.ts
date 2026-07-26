export async function runYouTubeAction(
  persist: () => Promise<unknown>,
  action: () => Promise<unknown>,
  persistSettings: boolean,
) {
  if (persistSettings) await persist();
  await action();
}
