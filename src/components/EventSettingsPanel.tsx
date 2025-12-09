import React from "react";
import type { MysteryConfig } from "../types";
import { HolidayOptions } from "../types";
import LocationAutocomplete from "./LocationAutocomplete";

type Props = {
  config: MysteryConfig;
  setConfig: React.Dispatch<React.SetStateAction<MysteryConfig>>;
  fetchWikiPreview: (title?: string) => Promise<void> | void;
  fetchLocalPreview: (
    lat: number,
    lon: number,
    name?: string
  ) => Promise<void> | void;
};

const EventSettingsPanel: React.FC<Props> = ({
  config,
  setConfig,
  fetchWikiPreview,
  fetchLocalPreview,
}) => {
  return (
    <section className="panel">
      <div className="panel-header-row">
        <h2>Event settings</h2>
      </div>

      <label className="field">
        <span>Holiday</span>
        <select
          value={config.holiday}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              holiday: e.target.value as MysteryConfig["holiday"],
            }))
          }
        >
          {HolidayOptions.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>

      {config.holiday === "Other" && (
        <label className="field">
          <span>Custom holiday or occasion</span>
          <input
            type="text"
            placeholder="e.g. Summer Garden Party, Retirement Bash"
            value={config.customHoliday}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                customHoliday: e.target.value,
              }))
            }
          />
        </label>
      )}

      <label className="field">
        <span>Number of rounds</span>
        <input
          type="number"
          min={2}
          max={6}
          value={config.rounds}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              rounds: Number(e.target.value) || 1,
            }))
          }
        />
      </label>

      <label className="field">
        <span>Optional: city or location for the story</span>
        <LocationAutocomplete
          value={config.location}
          onChange={(v) => setConfig((prev) => ({ ...prev, location: v }))}
          onSelect={(place) => {
            const addr = place.address || ({} as Record<string, unknown>);
            const townName =
              (addr["town"] as string | undefined) ||
              (addr["city"] as string | undefined) ||
              (addr["village"] as string | undefined) ||
              (addr["hamlet"] as string | undefined) ||
              (addr["municipality"] as string | undefined) ||
              (addr["county"] as string | undefined) ||
              (addr["state"] as string | undefined) ||
              (place.display_name || "").split(",")[0];

            const lat = place.lat ? Number(place.lat) : undefined;
            const lon = place.lon ? Number(place.lon) : undefined;
            setConfig((prev) => ({
              ...prev,
              location: townName,
              locationCoords: lat && lon ? { lat, lon } : prev.locationCoords,
            }));
            fetchWikiPreview(townName);
            if (lat && lon) fetchLocalPreview(lat, lon, townName);
          }}
          placeholder="e.g. Edinburgh, Scotland or a snowy mountain village"
          nominatimEmail="dev@local"
        />
        <small className="hint">
          Please don&apos;t include your full address — just a city, region, or
          type of place.
        </small>
      </label>

      <label className="field">
        <span>Overall tone</span>
        <select
          value={config.tone}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              tone: e.target.value as MysteryConfig["tone"],
            }))
          }
        >
          <option value="light">Light &amp; silly (family friendly)</option>
          <option value="mixed">Mixed tones (comedy + drama)</option>
          <option value="serious">More serious mystery</option>
        </select>
      </label>

      <label className="field">
        <span>Extra notes for the writer</span>
        <textarea
          placeholder="Any themes to include/avoid, in-jokes, location, time period, etc."
          value={config.settingNotes}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              settingNotes: e.target.value,
            }))
          }
        />
      </label>

      <label className="field">
        <span>
          <input
            type="checkbox"
            checked={config.enableWikiEnrichment ?? true}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                enableWikiEnrichment: e.target.checked,
              }))
            }
          />
          &nbsp;Enable Wikipedia enrichment and preview
        </span>
        <small className="hint">
          When enabled, the app will fetch a short Wikipedia summary for the
          provided location and include a short note in the generated prompt. No
          API keys are required.
        </small>
        {!config.enableWikiEnrichment && (
          <div style={{ marginTop: 6 }}>
            <small className="hint">Wikipedia enrichment is disabled.</small>
          </div>
        )}
      </label>
    </section>
  );
};

export default EventSettingsPanel;
