import type { LocalEnrichment } from "../types";

const CACHE_TTL_MS_POIS = 1000 * 60 * 60 * 24; // 24h for POIs / static data
const CACHE_TTL_MS_WEATHER = 1000 * 60 * 10; // 10 minutes for weather
type CacheEntry = { ts: number; value: unknown };

// Inflight dedupe: map storage key -> promise
const inflight = new Map<string, Promise<unknown>>();

function storageKey(lat: number, lon: number) {
  return `localEnrich:${lat.toFixed(4)}:${lon.toFixed(4)}`;
}

function getFromStorage(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    return parsed;
  } catch {
    return null;
  }
}

function setStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch {
    // ignore quota errors
  }
}

async function fetchWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=sunrise,sunset&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather fetch failed");
  const j = await res.json();
  const current = j.current_weather ?? null;
  const daily = j.daily ?? null;
  return {
    tempC: current?.temperature,
    condition: current ? String(current.weathercode) : undefined,
    sunrise: daily?.sunrise?.[0],
    sunset: daily?.sunset?.[0],
  };
}

// ===================================================================================
// Fetch POIs while excluding pubs, banks, ATMs, cafes, etc. (clean, no debug logs)
// ===================================================================================

async function fetchPOIs(lat: number, lon: number, name?: string) {
  type OverpassElLocal = {
    tags?: Record<string, string>;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
  };
  type POIWithMetaLocal = {
    name: string;
    type: string;
    distanceMeters: number;
    wikidata?: string;
    wikipedia?: string;
  };

  const allowed = {
    amenity: [
      "arts_centre",
      "cafe",
      "cinema",
      "gallery",
      "guest_house",
      "hotel",
      "library",
      "marketplace",
      "museum",
      "place_of_worship",
      "restaurant",
      "theatre",
      "town_hall",
    ],
    tourism: ["museum", "attraction"],
    historic: ["monument", "castle", "memorial"],
    leisure: ["park", "playground"],
    shop: ["books", "bakery"],
  } as Record<string, string[]>;

  const RADIUS = 5000;

  const buildQuery = (radius: number) => {
    const clauses: string[] = [];
    for (const [k, vals] of Object.entries(allowed)) {
      if (!vals || vals.length === 0) continue;
      const regex = vals
        .map((v) => v.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
        .join("|");
      clauses.push(
        `node(around:${radius},${lat},${lon})[name][${k}~"^(${regex})$"];`
      );
      clauses.push(
        `way(around:${radius},${lat},${lon})[name][${k}~"^(${regex})$"];`
      );
    }
    clauses.push(`node(around:${radius},${lat},${lon})[name];`);
    clauses.push(`way(around:${radius},${lat},${lon})[name];`);
    return `
      [out:json][timeout:15];
      (
        ${clauses.join("\n        ")}
      );
      out center 40;
    `;
  };

  const isUndesiredFeature = (tags?: Record<string, string>) => {
    if (!tags) return false;
    const hw = tags.highway;
    if (hw && /motorway|motorway_link|trunk|trunk_link/.test(hw)) return true;
    return false;
  };

  const parseElements = (elements?: OverpassElLocal[]) => {
    const list: POIWithMetaLocal[] = [];
    if (!Array.isArray(elements)) return list;
    for (const e of elements) {
      const tags = e.tags ?? {};
      if (isUndesiredFeature(tags)) continue;
      const name = tags.name;
      if (!name) continue;
      const placeTag = tags.place;
      if (
        placeTag === "suburb" ||
        placeTag === "neighbourhood" ||
        placeTag === "locality"
      )
        continue;
      const elat = e.lat ?? e.center?.lat;
      const elon = e.lon ?? e.center?.lon;
      if (elat == null || elon == null) continue;
      const d = distanceMeters(lat, lon, elat, elon);
      const type =
        (tags.amenity as string) ||
        (tags.tourism as string) ||
        (tags.historic as string) ||
        (tags.shop as string) ||
        (tags.leisure as string) ||
        (tags.office as string) ||
        (tags.building as string) ||
        "place";
      list.push({
        name,
        type,
        distanceMeters: Math.round(d),
        wikidata: tags.wikidata,
        wikipedia: tags.wikipedia,
      });
    }
    return list;
  };

  // Primary Overpass
  let elements: OverpassElLocal[] = [];
  try {
    const q = buildQuery(RADIUS);
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: q,
    });
    if (res.ok) {
      const j = await res.json().catch(() => null);
      elements = (j?.elements as OverpassElLocal[]) || [];
    }
  } catch {
    // ignore
  }

  // Secondary endpoint
  if (!elements || elements.length === 0) {
    try {
      const q = buildQuery(RADIUS);
      const res2 = await fetch(
        "https://overpass.kumi.systems/api/interpreter",
        { method: "POST", headers: { "Content-Type": "text/plain" }, body: q }
      );
      if (res2.ok) {
        const j2 = await res2.json().catch(() => null);
        elements = (j2?.elements as OverpassElLocal[]) || [];
      }
    } catch {
      // ignore
    }
  }

  const poisRaw = parseElements(elements)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 12);

  const typePrecedence: Record<string, number> = {
    museum: 1,
    monument: 2,
    castle: 2,
    gallery: 3,
    theatre: 3,
    arts_centre: 3,
    cinema: 4,
    park: 5,
    restaurant: 6,
    cafe: 7,
    hotel: 8,
  };
  const scored = poisRaw.map((p) => {
    const hasData = p.wikidata || p.wikipedia ? 1 : 0;
    const tp = typePrecedence[p.type] ?? 20;
    const score =
      (hasData ? 0 : 5) + tp + Math.round((p.distanceMeters ?? 0) / 1000);
    return { p, score };
  });
  const primary = scored.sort((a, b) => a.score - b.score)[0];
  const pois = poisRaw;
  let primaryPOI = primary ? primary.p : null;

  // Large radius fallback
  if (pois.length === 0) {
    try {
      const LARGE_RADIUS = 20000;
      const q = buildQuery(LARGE_RADIUS);
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: q,
      });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        const felems = (j?.elements as OverpassElLocal[]) || [];
        const fallbackPois = parseElements(felems)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 6);
        if (fallbackPois.length > 0) {
          const deny = new Set([
            "bank",
            "atm",
            "parking",
            "toilets",
            "fuel",
            "taxi",
            "police",
            "hospital",
            "pub",
            "bar",
            "kindergarten",
            "hairdresser",
          ]);
          const filtered = fallbackPois.filter((p) => !deny.has(p.type));
          if (filtered.length > 0)
            return { pois: filtered, primaryPOI: filtered[0] };
          return { pois: fallbackPois, primaryPOI: fallbackPois[0] };
        }
      }
    } catch {
      // ignore
    }
  }

  const deny = new Set([
    "bank",
    "atm",
    "parking",
    "toilets",
    "fuel",
    "taxi",
    "police",
    "hospital",
    "pub",
    "bar",
    "kindergarten",
    "hairdresser",
  ]);
  const poisFiltered = pois.filter((p) => !deny.has(p.type));
  if (poisFiltered.length > 0) {
    if (!primaryPOI && poisFiltered.length > 0) primaryPOI = poisFiltered[0];
    return { pois: poisFiltered, primaryPOI };
  }

  // Bbox fallback via Nominatim
  if (name) {
    try {
      const params = new URLSearchParams({
        q: name,
        format: "json",
        limit: "1",
      });
      const nres = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );
      if (nres.ok) {
        const njson = await nres.json().catch(() => null);
        if (Array.isArray(njson) && njson.length > 0) {
          const bb = njson[0].boundingbox as string[] | undefined;
          if (bb && bb.length === 4) {
            const south = Number(bb[0]);
            const north = Number(bb[1]);
            const west = Number(bb[2]);
            const east = Number(bb[3]);
            const bboxQ = `
              [out:json][timeout:20];
              (
                node(${south},${west},${north},${east})[name];
                way(${south},${west},${north},${east})[name];
              );
              out center 40;
            `;
            const bres = await fetch(
              "https://overpass-api.de/api/interpreter",
              {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: bboxQ,
              }
            );
            if (bres.ok) {
              const bj = await bres.json().catch(() => null);
              const belems = (bj?.elements as OverpassElLocal[]) || [];
              const bpois = parseElements(belems)
                .filter((p) => !deny.has(p.type))
                .sort((a, b) => a.distanceMeters - b.distanceMeters)
                .slice(0, 12);
              if (bpois.length > 0) {
                const scoredB = bpois.map((p) => {
                  const hasData = p.wikidata || p.wikipedia ? 1 : 0;
                  const tp = typePrecedence[p.type] ?? 20;
                  const score =
                    (hasData ? 0 : 5) +
                    tp +
                    Math.round((p.distanceMeters ?? 0) / 1000);
                  return { p, score };
                });
                const prim = scoredB.sort((a, b) => a.score - b.score)[0];
                return { pois: bpois, primaryPOI: prim ? prim.p : null };
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { pois, primaryPOI };
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  if (!lat2 || !lon2) return Number.MAX_SAFE_INTEGER;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===================================================================================
// MAIN EXPORT
// ===================================================================================

export async function getLocalEnrichment(opts: {
  lat: number;
  lon: number;
  name?: string;
}) {
  const { lat, lon, name } = opts;
  const key = storageKey(lat, lon);

  // If there's an inflight request for the same key, return that promise
  const existing = inflight.get(key);
  if (existing) return existing as Promise<LocalEnrichment>;

  const promise = (async () => {
    // try storage
    const cached = getFromStorage(key);

    let useCachedPOIs: boolean = false;
    let useCachedWeather: boolean = false;
    let cachedValue: LocalEnrichment | null = null;

    if (cached && cached.ts) {
      const age = Date.now() - cached.ts;
      if (age < CACHE_TTL_MS_POIS) useCachedPOIs = true;
      if (age < CACHE_TTL_MS_WEATHER) useCachedWeather = true;
      if (useCachedPOIs || useCachedWeather)
        cachedValue = cached.value as LocalEnrichment;
    }

    // If the cached value contains an empty topPOIs array, treat that as a cache miss for POIs.
    // This avoids returning a previously-failed empty result forever. We preserve other cached
    // fields (like weather) but force a fresh POI fetch. Also update storage to remove the
    // empty POI list so subsequent reads won't see an empty cached value.
    try {
      if (
        cachedValue &&
        Array.isArray((cachedValue as LocalEnrichment).topPOIs) &&
        (cachedValue as LocalEnrichment).topPOIs!.length === 0
      ) {
        useCachedPOIs = false;
        // remove POI-specific fields from the cached value and persist the cleaned cache
        const cleaned = {
          ...cachedValue,
          topPOIs: undefined,
          primaryPOI: null,
        } as LocalEnrichment;
        try {
          setStorage(key, cleaned);
        } catch {
          /* ignore cache write failure */
        }
        // keep cachedValue so weather/admin/etc remain available, but ensure topPOIs won't be used
        cachedValue = cleaned;
      }
    } catch {
      // be defensive — if anything goes wrong, just continue and fetch fresh
      useCachedPOIs = false;
    }

    // Decide what to fetch; keep explicit promise types for TS
    type POI = { name: string; type: string; distanceMeters: number };
    type Weather = {
      tempC?: number;
      condition?: string;
      sunrise?: string;
      sunset?: string;
    } | null;

    const weatherPromise: Promise<Weather> = useCachedWeather
      ? Promise.resolve((cachedValue?.currentWeather as Weather) ?? null)
      : fetchWeather(lat, lon);

    const denylist = new Set([
      "bank",
      "atm",
      "parking",
      "toilets",
      "fuel",
      "taxi",
      "police",
      "hospital",
    ]);

    const poisPromise: Promise<{ pois: POI[]; primaryPOI?: POI | null }> =
      useCachedPOIs
        ? (async () => {
            // Filter cached POIs through denylist to avoid returning stale undesired types
            const cachedPois = (cachedValue?.topPOIs as POI[]) ?? [];
            const filtered = cachedPois.filter((p) => !denylist.has(p.type));
            // Recompute primary if possible (prefer cached primary if still allowed)
            let primary: POI | null = null;
            const cachedPrimary = (cachedValue?.primaryPOI as POI) ?? null;
            if (cachedPrimary && !denylist.has(cachedPrimary.type))
              primary = cachedPrimary;
            if (!primary && filtered.length > 0) primary = filtered[0];
            // using cached POIs (filtered)
            return { pois: filtered, primaryPOI: primary };
          })()
        : fetchPOIs(lat, lon, name);

    const results = await Promise.allSettled([weatherPromise, poisPromise]);

    const weather =
      results[0].status === "fulfilled" ? (results[0].value as Weather) : null;
    const poisObj =
      results[1].status === "fulfilled"
        ? (results[1].value as { pois: POI[]; primaryPOI?: POI | null })
        : { pois: [] };
    const pois = poisObj.pois ?? [];
    const primaryFromFetch = poisObj.primaryPOI ?? null;

    const out: LocalEnrichment = {
      canonicalName: name,
      country: cachedValue?.country,
      admin: cachedValue?.admin ?? [],
      population: cachedValue?.population ?? null,
      timezone: cachedValue?.timezone ?? null,
      elevationMeters: cachedValue?.elevationMeters ?? null,
      coordinates: { lat, lon },
      topPOIs: pois,
      primaryPOI: primaryFromFetch ?? null,
      notableFacts: cachedValue?.notableFacts ?? [],
      currentWeather: weather,
      wikiTitle: cachedValue?.wikiTitle ?? null,
    };

    try {
      setStorage(key, out);
    } catch {
      // ignore storage errors
    }

    return out;
  })();

  inflight.set(key, promise);
  try {
    const res = await promise;
    return res as LocalEnrichment;
  } finally {
    inflight.delete(key);
  }
}

export default getLocalEnrichment;
