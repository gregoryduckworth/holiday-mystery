import "./index.css";
import { useState } from "react";
import type {
  MysteryConfig,
  Player,
  CharacterScript,
  LocalEnrichment,
  InspectorSegment,
} from "./types";
import { HolidayOptions } from "./types";
import jsPDF from "jspdf";
import { generateMysteryScript } from "./generateMystery";
import { fetchWikiSummaryByTitle, type WikiSummary } from "./lib/wiki";
import getLocalEnrichment from "./lib/localEnrich";
import LocationAutocomplete from "./components/LocationAutocomplete";

const defaultConfig: MysteryConfig = {
  holiday: "Christmas",
  customHoliday: "",
  rounds: 3,
  location: "",
  settingNotes: "",
  tone: "light",
  players: [
    { id: 1, name: "", age: "adult", sex: "Prefer not to say" },
    { id: 2, name: "", age: "adult", sex: "Prefer not to say" },
    { id: 3, name: "", age: "child", sex: "Prefer not to say" },
    { id: 4, name: "", age: "child", sex: "Prefer not to say" },
  ],
};

function App() {
  const [config, setConfig] = useState<MysteryConfig>(defaultConfig);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    import("./types").MysteryScriptResult | null
  >(null);
  const [wikiPreview, setWikiPreview] = useState<WikiSummary | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<LocalEnrichment | null>(
    null
  );
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedPOIs, setSelectedPOIs] = useState<
    Array<{ name: string; type?: string; distanceMeters?: number }>
  >([]);
  // Transient OpenAI API key entered by the user for this session. Not persisted.
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [showOpenaiKey, setShowOpenaiKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4.1-mini");
  const envKeyPresent = Boolean(import.meta.env.VITE_OPENAI_API_KEY);

  const updatePlayer = (id: number, field: keyof Player, value: string) => {
    setConfig((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  };

  const addPlayer = () => {
    setConfig((prev) => ({
      ...prev,
      players: [
        ...prev.players,
        { id: Date.now(), name: "", age: "child", sex: "Prefer not to say" },
      ],
    }));
  };

  const removePlayer = (id: number) => {
    setConfig((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
  };

  const buildCharacterScriptPdf = (character: CharacterScript): void => {
    const doc = new jsPDF();
    const marginLeft = 14;
    let cursorY = 16;

    const addWrappedText = (text: string, options?: { bold?: boolean }) => {
      const maxWidth = 180;
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      lines.forEach((line) => {
        if (cursorY > 280) {
          doc.addPage();
          cursorY = 16;
        }
        doc.text(line, marginLeft, cursorY);
        cursorY += 6;
      });
      cursorY += 2;
    };

    const playerLabel = character.playerName || "Player";

    doc.setFontSize(18);
    addWrappedText(`${playerLabel} as ${character.characterName}`, {
      bold: true,
    });

    doc.setFontSize(12);

    addWrappedText("What to wear:", { bold: true });
    addWrappedText(character.costumeDescription);

    addWrappedText("Personality:", { bold: true });
    addWrappedText(character.personality);

    addWrappedText("Private backstory (do not share with others):", {
      bold: true,
    });
    addWrappedText(character.secretBackstory);

    addWrappedText("Round-by-round lines:", { bold: true });

    character.perRoundLines.forEach((raw, index) => {
      addWrappedText(`Round ${index + 1}:`, { bold: true });
      const segments = raw.split(/\r?\n/).filter(Boolean);
      segments.forEach((segment) => {
        addWrappedText(`• ${segment}`);
      });
      cursorY += 2;
    });

    const safeName = (playerLabel || "player")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    doc.save(`${safeName}-script.pdf`);
  };

  const buildInspectorPdf = (segments: InspectorSegment[]): void => {
    const doc = new jsPDF();
    const marginLeft = 14;
    let cursorY = 16;

    const addWrappedText = (text: string, options?: { bold?: boolean }) => {
      const maxWidth = 180;
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      lines.forEach((line) => {
        if (cursorY > 280) {
          doc.addPage();
          cursorY = 16;
        }
        doc.text(line, marginLeft, cursorY);
        cursorY += 6;
      });
      cursorY += 2;
    };

    doc.setFontSize(18);
    addWrappedText(`Inspector / Police inspector segments`, { bold: true });
    doc.setFontSize(12);
    addWrappedText("(Contains answers — reveal only to the game master)");

    segments.forEach((seg) => {
      addWrappedText(`Round ${seg.round}: ${seg.title}`, { bold: true });
      addWrappedText(seg.description || "");
      cursorY += 4;
    });

    doc.save(`inspector.pdf`);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const script = await generateMysteryScript(
        config,
        selectedPOIs,
        openaiKey || undefined,
        selectedModel
      );
      setResult(script);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while generating your mystery.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchWikiPreview = async (title?: string) => {
    const t = title ?? config.location;
    if (!t || !config.enableWikiEnrichment) {
      setWikiPreview(null);
      setWikiError(null);
      return;
    }
    setWikiLoading(true);
    setWikiError(null);
    try {
      const s = await fetchWikiSummaryByTitle(t);
      setWikiPreview(s);
    } catch (err) {
      console.warn("Wiki preview failed", err);
      setWikiError(err instanceof Error ? err.message : String(err));
      setWikiPreview(null);
    } finally {
      setWikiLoading(false);
    }
  };

  const fetchLocalPreview = async (lat: number, lon: number, name?: string) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const data = await getLocalEnrichment({ lat, lon, name });
      setLocalPreview(data);
      // Initialize selectedPOIs to none selected but keep synchrony so the
      // checkbox UI and the places list appear at the same time. We do not
      // auto-select items — just ensure the array is reset when new local data
      // arrives, preventing a flicker where the list shows but checkboxes lag.
      setSelectedPOIs([]);
    } catch (err) {
      console.warn("Local preview failed", err);
      setLocalError(err instanceof Error ? err.message : String(err));
      setLocalPreview(null);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="app-root">
      {isGenerating && (
        <div className="fullpage-loader" role="status" aria-live="polite">
          <div className="loader-box">
            <div className="spinner" aria-hidden="true" />
            <div className="loader-message">Generating your mystery…</div>
          </div>
        </div>
      )}

      <main className="app-main">
        <header className="app-header">
          <h1>Holiday Mystery Generator</h1>
          <p>
            Configure your cast, choose a holiday, and generate a tailored
            mystery with scripted rounds and an in-character inspector.
          </p>
        </header>

        {error && (
          <div
            className="error-banner"
            style={{ marginTop: 8, marginBottom: 16 }}
          >
            <strong>Oops.</strong> {error}
          </div>
        )}

        <section className="panel">
          <div className="panel-header-row">
            <h2>OpenAI key (optional)</h2>
            <div>
              <div className={`api-key-status pill`} aria-hidden>
                {openaiKey
                  ? "Using provided key"
                  : envKeyPresent
                  ? "Using environment key"
                  : "No API key available"}
              </div>
            </div>
          </div>

          <div>
            <label className="field">
              <span>Paste an OpenAI API key for this session</span>

              <div className="api-key-body">
                <div className="api-key-row">
                  <div className="api-key-input">
                    <input
                      type={showOpenaiKey ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-... (not stored)"
                      aria-label="OpenAI API key"
                    />
                  </div>

                  <div className="api-key-controls">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowOpenaiKey((s) => !s)}
                      aria-pressed={showOpenaiKey}
                    >
                      {showOpenaiKey ? "Hide" : "Show"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setOpenaiKey("");
                        setShowOpenaiKey(false);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="model-row">
                  <label className="field">
                    <span>Model</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      title={
                        "Model differences: gpt-4.1-mini — high quality; gpt-4o — experimental; gpt-3.5-turbo — cheaper and faster."
                      }
                    >
                      <option value="gpt-4.1-mini">
                        gpt-4.1-mini (default)
                      </option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o-realtime-preview">
                        gpt-4o-realtime-preview
                      </option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <small className="hint">
                  The key stays in memory for this session only and is not saved
                  to disk.
                </small>
              </div>
            </label>
          </div>
        </section>

        <form onSubmit={handleGenerate} className="form-grid">
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
                onChange={(v) =>
                  setConfig((prev) => ({ ...prev, location: v }))
                }
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
                    locationCoords:
                      lat && lon ? { lat, lon } : prev.locationCoords,
                  }));
                  fetchWikiPreview(townName);
                  if (lat && lon) fetchLocalPreview(lat, lon, townName);
                }}
                placeholder="e.g. Edinburgh, Scotland or a snowy mountain village"
                nominatimEmail="dev@local"
              />
              <small className="hint">
                Please don&apos;t include your full address — just a city,
                region, or type of place.
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
                <option value="light">
                  Light &amp; silly (family friendly)
                </option>
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
                When enabled, the app will fetch a short Wikipedia summary for
                the provided location and include a short note in the generated
                prompt. No API keys are required.
              </small>
              {/* Show disabled notice inline next to the checkbox when off */}
              {!config.enableWikiEnrichment && (
                <div style={{ marginTop: 6 }}>
                  <small className="hint">
                    Wikipedia enrichment is disabled.
                  </small>
                </div>
              )}
            </label>
          </section>

          <section className="panel players-panel">
            <div className="panel-header-row">
              <h2>Players &amp; characters</h2>
              <button
                type="button"
                className="secondary-button"
                onClick={addPlayer}
              >
                + Add player
              </button>
            </div>

            <div className="panel-body">
              <p className="hint">
                Add everyone who will play. The generator will tailor character
                roles, costumes, and personalities to them.
              </p>

              <div className="players-grid">
                {config.players.map((player, index) => (
                  <div key={player.id} className="player-card">
                    <div className="player-card-header">
                      <h3>Player {index + 1}</h3>
                      {config.players.length > 2 && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => removePlayer(player.id)}
                          aria-label={`Remove player ${index + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <label className="field">
                      <span>Name</span>
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) =>
                          updatePlayer(player.id, "name", e.target.value)
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Age group</span>
                      <select
                        value={player.age}
                        onChange={(e) =>
                          updatePlayer(
                            player.id,
                            "age",
                            e.target.value as Player["age"]
                          )
                        }
                      >
                        <option value="adult">Adult</option>
                        <option value="child">Child</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Sex</span>
                      <select
                        value={player.sex}
                        onChange={(e) =>
                          updatePlayer(
                            player.id,
                            "sex",
                            e.target.value as Player["sex"]
                          )
                        }
                      >
                        <option value="M">M</option>
                        <option value="F">F</option>
                        <option value="Prefer not to say">
                          Prefer not to say
                        </option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* footer intentionally left empty; generate button moved below location preview */}
          </section>
        </form>
        <section className="panel">
          <h2>Location preview</h2>
          <p className="hint">
            Preview the Wikipedia summary for the location.
          </p>

          <div className="wiki-preview">
            {config.enableWikiEnrichment ? (
              wikiLoading ? (
                <div className="wiki-loader" role="status" aria-live="polite">
                  <div className="wiki-spinner" aria-hidden="true" />
                  <div className="wiki-loader-text">
                    Loading Wikipedia summary…
                  </div>
                </div>
              ) : wikiError ? (
                <div className="error-banner">{wikiError}</div>
              ) : wikiPreview ? (
                <div>
                  <h3>{wikiPreview.title}</h3>
                  <p>{wikiPreview.extract}</p>
                  {wikiPreview.content_urls?.desktop?.page && (
                    <a
                      href={wikiPreview.content_urls.desktop.page}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read on Wikipedia
                    </a>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => fetchWikiPreview()}
                      className="secondary-button"
                    >
                      Refresh preview
                    </button>
                  </div>
                </div>
              ) : (
                <p className="hint">No Wikipedia summary available.</p>
              )
            ) : null}

            <div className="local-preview" style={{ marginTop: 12 }}>
              {localLoading ? (
                <div className="wiki-loader" role="status" aria-live="polite">
                  <div className="wiki-spinner" aria-hidden="true" />
                  <div className="wiki-loader-text">Loading local data…</div>
                </div>
              ) : localError ? (
                <div className="error-banner">{localError}</div>
              ) : localPreview ? (
                <div>
                  <h4>Local context</h4>
                  {localPreview.currentWeather && (
                    <p className="hint">
                      Weather: {localPreview.currentWeather.tempC}°C —{" "}
                      {localPreview.currentWeather.condition}
                    </p>
                  )}
                  {localPreview.topPOIs && localPreview.topPOIs.length > 0 && (
                    <div>
                      <strong>Nearby places:</strong>
                      <ul>
                        {localPreview.topPOIs.map((p, i) => {
                          const checked = selectedPOIs.some(
                            (s) => s.name === p.name && s.type === p.type
                          );
                          return (
                            <li
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Select ${p.name} as a clue location`}
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPOIs((prev) => [
                                      ...prev,
                                      {
                                        name: p.name,
                                        type: p.type,
                                        distanceMeters: p.distanceMeters,
                                      },
                                    ]);
                                  } else {
                                    setSelectedPOIs((prev) =>
                                      prev.filter(
                                        (s) =>
                                          !(
                                            s.name === p.name &&
                                            s.type === p.type
                                          )
                                      )
                                    );
                                  }
                                }}
                              />
                              <span>
                                {p.name} ({p.type}) • {p.distanceMeters}m
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <p className="hint" style={{ fontSize: 12 }}>
                    Data courtesy of OpenStreetMap and Open-Meteo. See{" "}
                    <a href="https://www.openstreetmap.org/">OSM</a> and{" "}
                    <a href="https://open-meteo.com/">Open-Meteo</a>.
                  </p>
                </div>
              ) : (
                <p className="hint">No local data available yet.</p>
              )}
            </div>
          </div>
        </section>

        {/* Global generate button moved here so it remains under the left column previews */}
        <div className="global-generate-wrapper">
          <button
            type="button"
            className="primary-button"
            onClick={async () => {
              await handleGenerate();
            }}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating…" : "Generate holiday mystery"}
          </button>
        </div>

        {/* error banner moved above the form */}

        {result && (
          <section className="panel result-panel">
            <h2>Generated mystery</h2>
            <p className="hint">Copy and share this with your players.</p>

            <h3>Overview</h3>
            <p>{result.overview}</p>

            <h3>How to play</h3>
            <pre className="mono-block">{result.howToPlay}</pre>

            <h3>Inspector / police inspector segments</h3>
            <details>
              <summary>Show inspector answers (GM only)</summary>
              <div style={{ marginTop: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => buildInspectorPdf(result.inspectorSegments)}
                >
                  Download inspector (PDF)
                </button>
              </div>

              <div className="inspector-grid">
                {result.inspectorSegments.map((seg) => (
                  <div
                    key={`${seg.round}-${seg.title}`}
                    className="inspector-card"
                  >
                    <h4>
                      Round {seg.round}: {seg.title}
                    </h4>
                    <p>{seg.description}</p>
                  </div>
                ))}
              </div>
            </details>

            <h3>Characters &amp; costumes</h3>
            <div className="characters-grid">
              {result.characters.map((ch) => (
                <div
                  key={ch.playerName + ch.characterName}
                  className="character-card"
                >
                  <h4>
                    {ch.playerName || "Player"} as {ch.characterName}
                  </h4>
                  <button
                    type="button"
                    className="download-link"
                    onClick={() => buildCharacterScriptPdf(ch)}
                  >
                    Download this character&apos;s script (PDF)
                  </button>
                  <p>
                    <strong>What to wear:</strong> {ch.costumeDescription}
                  </p>
                  <p>
                    <strong>Personality:</strong> {ch.personality}
                  </p>
                  <p>
                    <strong>Private backstory (GM only):</strong>{" "}
                    {ch.secretBackstory}
                  </p>

                  <details>
                    <summary>Round-by-round lines</summary>
                    <div className="round-lines-list">
                      {ch.perRoundLines.map((raw, index) => {
                        const lines = raw.split(/\r?\n/).filter(Boolean);
                        const [first, ...rest] = lines;
                        return (
                          <div key={index} className="round-block">
                            {first && <p className="round-label">{first}</p>}
                            {rest.length > 0 && (
                              <ul className="round-dialogue-list">
                                {rest.map((l, i) => (
                                  <li key={i}>{l}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <h3>Final guessing phase</h3>
            <pre className="mono-block">{result.finalGuessInstructions}</pre>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
