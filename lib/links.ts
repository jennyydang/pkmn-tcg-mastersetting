import { TrackedMasterSet } from "./types";

/** Page for a tracked master set. IDs go in the query string (static export). */
export function masterSetHref({ type, id }: Pick<TrackedMasterSet, "type" | "id">): string {
  const q = encodeURIComponent(id);
  return type === "set" ? `/sets?id=${q}`
    : type === "artist" ? `/artist?name=${q}`
    : type === "custom" ? `/custom?id=${q}`
    : `/pokemon?name=${q}`;
}
