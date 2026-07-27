import { createClient, type RedisClientType } from "redis";

/**
 * Sleutel-waarde-opslag voor bestellingen en dashboard-content.
 *
 * Twee smaken worden herkend, afhankelijk van welke store in Vercel hangt:
 *
 * 1. TCP (Vercel Marketplace → Redis Cloud, Upstash met TCP, elke Redis):
 *      REDIS_URL="redis://…" of "rediss://…"
 *    Er wordt één client per serverinstance opgezet en hergebruikt.
 *
 * 2. REST (Vercel KV / Upstash REST):
 *      KV_REST_API_URL + KV_REST_API_TOKEN, of
 *      UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *
 * Staat geen van beide ingesteld, dan is KV uit en vallen bestellingen terug
 * op lokale bestandsopslag (demo). Alle calls vangen fouten af en gooien
 * NOOIT, zodat de checkout niet kan breken door een storing in de opslag.
 */

/* ── Configuratie ──────────────────────────────────────────────── */

function firstValue(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

const RAW_URL = firstValue(
  process.env.REDIS_URL,
  process.env.KV_URL,
  process.env.KV_REST_API_URL,
  process.env.UPSTASH_REDIS_REST_URL,
  process.env.REDIS_REST_API_URL,
);

const REST_TOKEN = firstValue(
  process.env.KV_REST_API_TOKEN,
  process.env.UPSTASH_REDIS_REST_TOKEN,
  process.env.REDIS_REST_API_TOKEN,
);

const isTcpUrl = Boolean(RAW_URL && /^rediss?:\/\//i.test(RAW_URL));
const isRestUrl = Boolean(RAW_URL && /^https?:\/\//i.test(RAW_URL) && REST_TOKEN);

export function isKvEnabled(): boolean {
  return isTcpUrl || isRestUrl;
}

/** Welke opslag actief is — voor /api/health. */
export function kvMode(): "redis" | "rest" | "uit" {
  if (isTcpUrl) return "redis";
  if (isRestUrl) return "rest";
  return "uit";
}

/* ── TCP-client (node-redis), één per serverinstance ───────────── */

type Client = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;

let client: Client | null = null;
let connecting: Promise<Client | null> | null = null;

async function getClient(): Promise<Client | null> {
  if (!isTcpUrl) return null;
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const next = createClient({
        url: RAW_URL,
        socket: { connectTimeout: 5000, reconnectStrategy: (tries) => (tries > 3 ? false : 200) },
      }) as Client;
      // Zonder listener gooit node-redis bij een verbindingsfout een unhandled error.
      next.on("error", (error) => console.error("[kv] redis-fout:", error));
      await next.connect();
      client = next;
      return next;
    } catch (error) {
      console.error("[kv] verbinden met Redis mislukt:", error);
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/* ── REST-client (Upstash-compatibel) ──────────────────────────── */

async function restCommand<T>(args: (string | number)[]): Promise<T | null> {
  try {
    const res = await fetch(RAW_URL!.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[kv] REST-commando mislukt", args[0], res.status);
      return null;
    }
    const data = (await res.json()) as { result?: T; error?: string };
    if (data.error) {
      console.error("[kv] REST-fout", data.error);
      return null;
    }
    return (data.result ?? null) as T | null;
  } catch (error) {
    console.error("[kv] REST-verzoek mislukt:", error);
    return null;
  }
}

/* ── Gedeelde bewerkingen ──────────────────────────────────────── */

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  let raw: string | null = null;
  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return null;
    try {
      raw = await redis.get(key);
    } catch (error) {
      console.error("[kv] GET mislukt:", error);
      return null;
    }
  } else if (isRestUrl) {
    raw = await restCommand<string>(["GET", key]);
  }
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Schrijft een waarde weg. `false` = niet gelukt (aanroeper kan terugvallen). */
export async function kvSetJSON(key: string, value: unknown): Promise<boolean> {
  const payload = JSON.stringify(value);
  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return false;
    try {
      await redis.set(key, payload);
      return true;
    } catch (error) {
      console.error("[kv] SET mislukt:", error);
      return false;
    }
  }
  if (isRestUrl) return (await restCommand(["SET", key, payload])) !== null;
  return false;
}

export async function kvDel(key: string): Promise<void> {
  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (error) {
      console.error("[kv] DEL mislukt:", error);
    }
    return;
  }
  if (isRestUrl) await restCommand(["DEL", key]);
}

export async function kvSAdd(key: string, member: string): Promise<void> {
  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return;
    try {
      await redis.sAdd(key, member);
    } catch (error) {
      console.error("[kv] SADD mislukt:", error);
    }
    return;
  }
  if (isRestUrl) await restCommand(["SADD", key, member]);
}

export async function kvSMembers(key: string): Promise<string[]> {
  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return [];
    try {
      return await redis.sMembers(key);
    } catch (error) {
      console.error("[kv] SMEMBERS mislukt:", error);
      return [];
    }
  }
  if (isRestUrl) {
    const res = await restCommand<string[]>(["SMEMBERS", key]);
    return Array.isArray(res) ? res : [];
  }
  return [];
}

/** Lees meerdere keys in één keer. Mist een key → null op die positie. */
export async function kvMGet(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return keys.map(() => null);
    try {
      return await redis.mGet(keys);
    } catch (error) {
      console.error("[kv] MGET mislukt:", error);
      return keys.map(() => null);
    }
  }
  if (isRestUrl) {
    const res = await restCommand<(string | null)[]>(["MGET", ...keys]);
    return Array.isArray(res) ? res : keys.map(() => null);
  }
  return keys.map(() => null);
}

/** Diagnose voor /api/health: is de opslag actief en antwoordt hij? */
export async function kvPing(): Promise<{ enabled: boolean; ok: boolean; mode: string }> {
  const mode = kvMode();
  if (mode === "uit") return { enabled: false, ok: false, mode };

  if (isTcpUrl) {
    const redis = await getClient();
    if (!redis) return { enabled: true, ok: false, mode };
    try {
      const pong = await redis.ping();
      return { enabled: true, ok: pong.toUpperCase() === "PONG", mode };
    } catch {
      return { enabled: true, ok: false, mode };
    }
  }

  const res = await restCommand<string>(["PING"]);
  return { enabled: true, ok: typeof res === "string" && res.toUpperCase() === "PONG", mode };
}
