/**
 * Minimale, dependency-vrije KV-client op de Upstash REST API (ook wat Vercel
 * KV onder water gebruikt). Zelfde opzet als de Klus=r-site, zodat het
 * VDM-dashboard beide shops op dezelfde manier kan uitlezen.
 *
 * Activeren: maak in Vercel een KV/Upstash-store aan — dan worden deze
 * env-vars automatisch gezet:
 *   KV_REST_API_URL + KV_REST_API_TOKEN               (Vercel KV), of
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash)
 *
 * Zonder deze env-vars is KV uit en valt de orderstore terug op lokale
 * bestandsopslag (demo). Alle calls vangen fouten af en gooien NOOIT, zodat
 * de checkout niet kan breken door een KV-storing.
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function isKvEnabled(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

/** Voer één Redis-commando uit via de REST API. Retourneert `null` bij elke fout. */
async function cmd<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!isKvEnabled()) return null;
  try {
    const res = await fetch(KV_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[kv] command failed", args[0], res.status);
      return null;
    }
    const data = (await res.json()) as { result?: T; error?: string };
    if (data.error) {
      console.error("[kv] error", data.error);
      return null;
    }
    return (data.result ?? null) as T | null;
  } catch (err) {
    console.error("[kv] request error", err);
    return null;
  }
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const raw = await cmd<string>(["GET", key]);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJSON(key: string, value: unknown): Promise<void> {
  await cmd(["SET", key, JSON.stringify(value)]);
}

export async function kvDel(key: string): Promise<void> {
  await cmd(["DEL", key]);
}

export async function kvSAdd(key: string, member: string): Promise<void> {
  await cmd(["SADD", key, member]);
}

export async function kvSMembers(key: string): Promise<string[]> {
  const res = await cmd<string[]>(["SMEMBERS", key]);
  return Array.isArray(res) ? res : [];
}

/** Lees meerdere keys in één keer (MGET). Mist een key → null op die positie. */
export async function kvMGet(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  const res = await cmd<(string | null)[]>(["MGET", ...keys]);
  return Array.isArray(res) ? res : keys.map(() => null);
}
