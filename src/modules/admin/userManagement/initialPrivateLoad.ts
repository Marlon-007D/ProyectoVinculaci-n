/** Visual markers only. Never cache member records or authorization decisions. */
export function createInitialPrivateLoadRegistry() {
  let owner: string | null = null;
  let claimed = false;
  return {
    claim(userId: string): boolean {
      if (owner !== userId) { claimed = false; owner = userId; }
      if (claimed) return false;
      claimed = true;
      return true;
    },
    clear() { owner = null; claimed = false; },
  };
}
