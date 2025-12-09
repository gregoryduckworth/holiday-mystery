import "./index.css";
import { useEffect, useRef, useState } from "react";
import type {
  MysteryConfig,
  Player,
  CharacterScript,
  LocalEnrichment,
  InspectorSegment,
} from "./types";
import { generateMysteryScript } from "./generateMystery";
import { fetchWikiSummaryByTitle, type WikiSummary } from "./lib/wiki";
import getLocalEnrichment from "./lib/localEnrich";
import {
  buildCharacterScriptPdf as buildCharacterScriptPdfShared,
  buildInspectorPdf as buildInspectorPdfShared,
} from "./lib/pdf";
import EventSettingsPanel from "./components/EventSettingsPanel";
import PlayersEditor from "./components/PlayersEditor";
import LocationPreviewPanel from "./components/LocationPreviewPanel";
import OpenAIKeyPanel from "./components/OpenAIKeyPanel";

const defaultConfig: MysteryConfig = {
  holiday: "Christmas",
  customHoliday: "",
  rounds: 3,
  location: "",
  settingNotes: "",
  tone: "light",
  enableWikiEnrichment: true,
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

  // Debounce timers and request IDs to prevent rapid re-fetches and race updates
  const wikiDebounceRef = useRef<number | null>(null);
  const localDebounceRef = useRef<number | null>(null);
  const wikiReqIdRef = useRef(0);
  const localReqIdRef = useRef(0);

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
    buildCharacterScriptPdfShared(character);
  };

  const buildInspectorPdf = (segments: InspectorSegment[]): void => {
    buildInspectorPdfShared(segments);
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

  const fetchWikiPreview = async (title?: string, reqId?: number) => {
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
      // Only update state if this request is the latest (guards against races)
      if (reqId == null || reqId === wikiReqIdRef.current) {
        setWikiPreview(s);
      }
    } catch (err) {
      console.warn("Wiki preview failed", err);
      if (reqId == null || reqId === wikiReqIdRef.current) {
        setWikiError(err instanceof Error ? err.message : String(err));
        setWikiPreview(null);
      }
    } finally {
      if (reqId == null || reqId === wikiReqIdRef.current) {
        setWikiLoading(false);
      }
    }
  };

  const fetchLocalPreview = async (
    lat: number,
    lon: number,
    name?: string,
    reqId?: number
  ) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const data = await getLocalEnrichment({ lat, lon, name });
      if (reqId == null || reqId === localReqIdRef.current) {
        setLocalPreview(data);
        // Initialize selectedPOIs to none selected but keep synchrony so the
        // checkbox UI and the places list appear at the same time. We do not
        // auto-select items — just ensure the array is reset when new local data
        // arrives, preventing a flicker where the list shows but checkboxes lag.
        setSelectedPOIs([]);
      }
    } catch (err) {
      console.warn("Local preview failed", err);
      if (reqId == null || reqId === localReqIdRef.current) {
        setLocalError(err instanceof Error ? err.message : String(err));
        setLocalPreview(null);
      }
    } finally {
      if (reqId == null || reqId === localReqIdRef.current) {
        setLocalLoading(false);
      }
    }
  };

  // Debounce automatic previews when the location or coordinates change
  useEffect(() => {
    // Clear pending timers
    if (wikiDebounceRef.current) {
      window.clearTimeout(wikiDebounceRef.current);
      wikiDebounceRef.current = null;
    }
    if (localDebounceRef.current) {
      window.clearTimeout(localDebounceRef.current);
      localDebounceRef.current = null;
    }

    const location = config.location;
    const locationCoords = config.locationCoords;
    const enableWikiEnrichment = config.enableWikiEnrichment;
    const coordsValid =
      typeof locationCoords?.lat === "number" &&
      typeof locationCoords?.lon === "number";

    // Debounce wiki preview (only if enabled and we have a location string)
    if (enableWikiEnrichment && location && location.trim().length > 0) {
      wikiDebounceRef.current = window.setTimeout(() => {
        wikiReqIdRef.current += 1;
        const reqId = wikiReqIdRef.current;
        // Call the latest fetchWikiPreview without capturing it in deps
        (async () => {
          await fetchWikiPreview(location, reqId);
        })();
      }, 400);
    }

    // Debounce local preview (only if we have coordinates)
    if (coordsValid) {
      const { lat, lon } = locationCoords!;
      localDebounceRef.current = window.setTimeout(() => {
        localReqIdRef.current += 1;
        const reqId = localReqIdRef.current;
        (async () => {
          await fetchLocalPreview(lat, lon, location, reqId);
        })();
      }, 400);
    }

    // Cleanup on config change or unmount
    return () => {
      if (wikiDebounceRef.current) {
        window.clearTimeout(wikiDebounceRef.current);
        wikiDebounceRef.current = null;
      }
      if (localDebounceRef.current) {
        window.clearTimeout(localDebounceRef.current);
        localDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.location,
    config.locationCoords?.lat,
    config.locationCoords?.lon,
    config.enableWikiEnrichment,
  ]);

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

        <OpenAIKeyPanel
          openaiKey={openaiKey}
          setOpenaiKey={setOpenaiKey}
          showOpenaiKey={showOpenaiKey}
          setShowOpenaiKey={setShowOpenaiKey}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          envKeyPresent={envKeyPresent}
        />

        <form onSubmit={handleGenerate} className="form-grid">
          <EventSettingsPanel
            config={config}
            setConfig={setConfig}
            fetchWikiPreview={fetchWikiPreview}
            fetchLocalPreview={fetchLocalPreview}
          />

          <PlayersEditor
            players={config.players}
            onAdd={addPlayer}
            onRemove={removePlayer}
            onUpdate={(id, field, value) =>
              updatePlayer(id, field as keyof Player, value)
            }
          />
        </form>
        <LocationPreviewPanel
          enableWikiEnrichment={config.enableWikiEnrichment ?? true}
          wikiLoading={wikiLoading}
          wikiError={wikiError}
          wikiPreview={wikiPreview}
          onRefreshWiki={() => fetchWikiPreview()}
          localLoading={localLoading}
          localError={localError}
          localPreview={localPreview}
          selectedPOIs={selectedPOIs}
          setSelectedPOIs={setSelectedPOIs}
        />

        {/* Generate controls with status and token estimate */}
        <div className="global-generate-wrapper">
          <button
            type="button"
            className="primary-button"
            onClick={async () => {
              await handleGenerate();
            }}
            disabled={isGenerating || (!openaiKey && !envKeyPresent)}
            aria-disabled={isGenerating || (!openaiKey && !envKeyPresent)}
            title={
              !openaiKey && !envKeyPresent
                ? "Provide an OpenAI API key to enable generation"
                : undefined
            }
          >
            {isGenerating ? "Generating…" : "Generate holiday mystery"}
          </button>
          {!openaiKey && !envKeyPresent && (
            <div className="hint" style={{ marginTop: 8 }}>
              Paste a runtime key above or set <code>VITE_OPENAI_API_KEY</code>{" "}
              in <code>.env.local</code> to enable generation.
            </div>
          )}
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
