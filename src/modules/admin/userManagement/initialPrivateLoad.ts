/** Visual markers only. Never cache member records or authorization decisions. */
export function createInitialPrivateLoadRegistry() {
  let owner: string | null = null;
  const panels = new Set<string>();
  return {
    claim(userId: string, panel: string): boolean {
      if (owner !== userId) { panels.clear(); owner = userId; }
      if (panels.has(panel)) return false;
      panels.add(panel);
      return true;
    },
    clear() { owner = null; panels.clear(); },
  };
}
