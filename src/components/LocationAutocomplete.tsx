import React, { useEffect, useRef, useState } from "react";

export type PlaceSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
  class?: string;
  type?: string;
  address?: { [k: string]: unknown };
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  placeholder?: string;
  minLength?: number;
  limit?: number;
  debounceMs?: number;
  nominatimEmail?: string;
};

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "e.g. Edinburgh, Scotland",
  minLength = 2,
  limit = 6,
  debounceMs = 300,
  nominatimEmail,
}: Props) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const activeIndexRef = useRef<number>(-1);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if ((query || "").length < minLength) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        q: query,
        format: "json",
        addressdetails: "0",
        limit: String(limit),
      });
      if (nominatimEmail) params.set("email", nominatimEmail);

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

      fetch(url, { signal: ctrl.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as PlaceSuggestion[];
          // Prefer place types that are towns/cities/villages/hamlets
          const allowedPlaceTypes = new Set([
            "city",
            "town",
            "village",
            "hamlet",
            "municipality",
          ]);

          const filtered = (json || []).filter((item) => {
            // if type is explicitly a town/city/village/hamlet
            if (item.type && allowedPlaceTypes.has(item.type)) return true;
            // accept if the address contains a county (we want county results)
            if (item.address && (item.address.county || item.address.state))
              return true;
            // accept administrative boundaries (often counties) as fallback
            if (item.class === "boundary" && item.type === "administrative")
              return true;
            return false;
          });

          setSuggestions(filtered);
          setOpen(true);
        })
        .catch((err: unknown) => {
          if (typeof err === "object" && err !== null && "name" in err) {
            const maybe = err as { name?: unknown };
            if (maybe.name === "AbortError") return;
          }
          console.warn("Nominatim search error", err);
          setError("Failed to fetch suggestions");
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => {
          setLoading(false);
        });
    }, debounceMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleInput = (v: string) => {
    setQuery(v);
    onChange(v);
  };

  const handleSelect = (place: PlaceSuggestion) => {
    setQuery(place.display_name);
    setSuggestions([]);
    setOpen(false);
    activeIndexRef.current = -1;
    onSelect(place);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndexRef.current = Math.min(
        activeIndexRef.current + 1,
        suggestions.length - 1
      );
      scrollToActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndexRef.current = Math.max(activeIndexRef.current - 1, 0);
      scrollToActive();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeIndexRef.current;
      if (idx >= 0 && idx < suggestions.length) handleSelect(suggestions[idx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const scrollToActive = () => {
    const list = listRef.current;
    const idx = activeIndexRef.current;
    if (!list || idx < 0) return;
    const item = list.children[idx] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="location-autocomplete" style={{ position: "relative" }}>
      <div className="input-row">
        <input
          type="text"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-activedescendant={
            open && activeIndexRef.current >= 0
              ? `loc-sug-${activeIndexRef.current}`
              : undefined
          }
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
          }}
        />

        <div className="input-status" aria-hidden>
          {loading && (
            <div className="status-bubble">
              <span className="small-spinner" aria-hidden />
              <span style={{ marginLeft: 8 }}>Searching…</span>
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Location suggestions"
          className="location-list"
        >
          {suggestions.map((s, i) => (
            <li
              id={`loc-sug-${i}`}
              key={`${s.display_name}-${s.lat}-${s.lon}-${i}`}
              role="option"
              aria-selected={activeIndexRef.current === i}
              onMouseDown={(ev) => {
                ev.preventDefault();
                handleSelect(s);
              }}
              className="location-item"
            >
              <div style={{ fontSize: 13 }}>{s.display_name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
