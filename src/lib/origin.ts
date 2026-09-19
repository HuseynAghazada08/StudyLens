export function isAllowedOrigin(origin: string | null, host: string | null, protocol: string, development: boolean): boolean {
  if (origin === null) return true;
  if (!host || !["http", "https"].includes(protocol)) return false;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) return false;
    if (parsed.origin === new URL(`${protocol}://${host}`).origin) return true;
    return development && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}
