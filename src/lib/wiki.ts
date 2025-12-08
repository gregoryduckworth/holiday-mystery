export type WikiSummary = {
  title: string;
  extract: string;
  description?: string;
  thumbnail?: { source: string; width?: number; height?: number };
  content_urls?: { desktop?: { page: string } };
  wikibase_item?: string;
};

export async function fetchWikiSummaryByTitle(
  title: string
): Promise<WikiSummary> {
  if (!title || title.trim() === "") throw new Error("Title required");
  const encoded = encodeURIComponent(title.trim());
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  const res = await fetch(url);
  if (res.status === 404)
    throw new Error(`No Wikipedia page for title: ${title}`);
  if (!res.ok) throw new Error(`Wikipedia summary fetch failed: ${res.status}`);

  const json = await res.json();

  const summary: WikiSummary = {
    title: json.title,
    extract: json.extract || json.extract_html || "",
    description: json.description,
    thumbnail: json.thumbnail,
    content_urls: json.content_urls,
    wikibase_item: json.wikibase_item,
  };

  return summary;
}

// Simple in-memory cache with TTL
const wikiCache = new Map<string, { ts: number; value: WikiSummary | null }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function cacheGet(key: string): WikiSummary | null {
  const e = wikiCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    wikiCache.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet(key: string, value: WikiSummary | null) {
  wikiCache.set(key, { ts: Date.now(), value });
}

// Resolve a town name to the best Wikipedia summary using several fallbacks.
export async function resolveTownToWikiSummary(
  townName: string,
  coords?: { lat: number; lon: number }
): Promise<WikiSummary | null> {
  const key = `${townName.toLowerCase()}|${coords?.lat ?? ""}|${
    coords?.lon ?? ""
  }`;
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
  const title = normalize(townName);

  // 1) exact summary
  try {
    const exact = await fetchWikiSummaryByTitle(title);
    if (exact && exact.extract && exact.extract.length > 12) {
      cacheSet(key, exact);
      return exact;
    }
  } catch (e: unknown) {
    console.debug("exact summary lookup failed", e);
  }

  // 2) search via action=query
  try {
    const q = new URL("https://en.wikipedia.org/w/api.php");
    q.searchParams.set("action", "query");
    q.searchParams.set("list", "search");
    q.searchParams.set("srsearch", title);
    q.searchParams.set("srlimit", "6");
    q.searchParams.set("format", "json");
    q.searchParams.set("origin", "*");
    const res = await fetch(q.toString());
    if (res.ok) {
      const json = await res.json();
      const first = json?.query?.search?.[0];
      if (first?.title) {
        try {
          const summ = await fetchWikiSummaryByTitle(first.title);
          if (summ && summ.extract && summ.extract.length > 12) {
            cacheSet(key, summ);
            return summ;
          }
        } catch (e: unknown) {
          console.debug("search fallback failed", e);
        }
      }
    }
  } catch (e: unknown) {
    console.debug("search request failed", e);
  }

  // 3) geosearch near coords (if available)
  if (coords) {
    try {
      const q = new URL("https://en.wikipedia.org/w/api.php");
      q.searchParams.set("action", "query");
      q.searchParams.set("list", "geosearch");
      q.searchParams.set("gscoord", `${coords.lat}|${coords.lon}`);
      q.searchParams.set("gsradius", "10000");
      q.searchParams.set("gslimit", "10");
      q.searchParams.set("format", "json");
      q.searchParams.set("origin", "*");
      const res = await fetch(q.toString());
      if (res.ok) {
        const json = await res.json();
        const candidates: Array<{
          pageid?: number;
          ns?: number;
          title?: string;
          lat?: number;
          lon?: number;
        }> = Array.isArray(json?.query?.geosearch) ? json.query.geosearch : [];

        const pick = candidates.find(
          (c) => (c.ns ?? -1) === 0 && typeof c.title === "string"
        );
        if (pick?.title) {
          try {
            const summ = await fetchWikiSummaryByTitle(pick.title);
            if (summ && summ.extract && summ.extract.length > 12) {
              cacheSet(key, summ);
              return summ;
            }
          } catch (e: unknown) {
            console.debug("geosearch candidate summary failed", e);
          }
        }
      }
    } catch (e: unknown) {
      console.debug("geosearch request failed", e);
    }
  }

  cacheSet(key, null);
  return null;
}
