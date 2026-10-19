import { networkFirst } from "./offlineCache";

// Euro → US dollar rate for Japanese card prices (Cardmarket lists them in euros).
// Daily European Central Bank rate from Frankfurter (free, no key); the last rate
// seen is kept for offline use, and a typical rate stands in if none was ever loaded.

const FALLBACK_EUR_TO_USD = 1.1;
const RATE_URL = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD";

let ratePromise: Promise<number> | null = null;

export function eurToUsdRate(): Promise<number> {
  ratePromise ??= networkFirst("fx:eur-usd", async () => {
    // Don't hold up prices if the rate service is slow; the fallback rate is close enough.
    const res = await fetch(RATE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Exchange rate request failed (${res.status})`);
    const rate = (await res.json())?.rates?.USD;
    if (typeof rate !== "number" || !(rate > 0)) throw new Error("No exchange rate in response");
    return rate;
  }).catch(() => FALLBACK_EUR_TO_USD);
  return ratePromise;
}
