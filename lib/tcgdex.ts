import { networkFirst } from "./offlineCache";
import { isOnline } from "./online";

// Requests to TCGdex (https://tcgdex.dev), shared by the English catalog
// (lib/api.ts) and Japanese cards (lib/japanese.ts). Responses are kept for
// offline use (lib/offlineCache.ts).

export type Lang = "en" | "ja";

const REST_BASE   = "https://api.tcgdex.net/v2";
const GRAPHQL_URL = "https://api.tcgdex.net/v2/graphql";

const MAX_ATTEMPTS = 4;

// Retries 429/5xx responses and dropped connections with backoff (1s, 2s, 4s).
// Other errors (e.g. a 404 for an unknown card) fail at once.
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    // Offline: fail at once so callers fall back to saved data without waiting out retries.
    if (!isOnline()) throw new Error("Offline");
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS || !isOnline()) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      continue;
    }
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) throw new ApiError(res.status);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
}

export class ApiError extends Error {
  constructor(public status: number, detail?: string) {
    super(`API error: ${detail ?? status}`);
  }
}

// A saved copy stands in for connection and server problems, not for answers
// like 404 that the API gave deliberately.
const isConnectionProblem = (e: unknown) => !(e instanceof ApiError && e.status < 500 && e.status !== 429);

/** GET a REST path, e.g. "/cards/sv03.5-025". English unless `lang` says otherwise. */
export async function restFetch<T>(path: string, lang: Lang = "en"): Promise<T> {
  // English keys keep their original form so existing offline copies still match.
  const key = lang === "en" ? `rest:${path}` : `rest:${lang}:${path}`;
  return networkFirst(key, async () => (await fetchWithRetry(`${REST_BASE}/${lang}${path}`)).json(), isConnectionProblem);
}

/** GraphQL query against the English catalog (TCGdex's GraphQL has no other languages). */
export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({ query, variables });
  return networkFirst(`gql:${body}`, async () => {
    const res = await fetchWithRetry(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const json = await res.json();
    if (json.errors?.length) throw new ApiError(400, json.errors[0].message);
    return json.data as T;
  }, isConnectionProblem);
}
