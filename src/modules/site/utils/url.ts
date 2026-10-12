export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}
