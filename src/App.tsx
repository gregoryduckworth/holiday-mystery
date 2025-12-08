import "./App.css";
import { useState } from "react";
import type {
  MysteryConfig,
  Player,
  HolidayOption,
  CharacterScript,
} from "./types";
import jsPDF from "jspdf";
import { generateMysteryScript } from "./generateMystery";

const defaultConfig: MysteryConfig = {
  holiday: "Christmas",
  customHoliday: "",
  rounds: 3,
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const script = await generateMysteryScript(config);
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

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Holiday Mystery Generator</h1>
        <p>
          Configure your cast, choose a holiday, and generate a tailored mystery
          with scripted rounds and an in-character inspector.
        </p>
      </header>

      <main>
        <form className="config-form" onSubmit={handleGenerate}>
          <section className="panel">
            <h2>Scenario basics</h2>

            <label className="field">
              <span>Holiday</span>
              <select
                value={config.holiday}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    holiday: e.target.value as HolidayOption,
                  }))
                }
              >
                <option value="Christmas">Christmas</option>
                <option value="New Year">New Year</option>
                <option value="Hannukah">Hannukah</option>
                <option value="Kwanzaa">Kwanzaa</option>
                <option value="Winter Solstice">Winter Solstice</option>
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
          </section>

          <section className="panel">
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
          </section>

          <footer className="form-footer">
            <button
              type="submit"
              className="primary-button"
              disabled={isGenerating}
            >
              {isGenerating ? "Generating…" : "Generate holiday mystery"}
            </button>
          </footer>
        </form>

        {error && (
          <div className="error-banner">
            <strong>Oops.</strong> {error}
          </div>
        )}

        {result && (
          <section className="panel result-panel">
            <h2>Generated mystery</h2>
            <p className="hint">Copy and share this with your players.</p>

            <h3>Overview</h3>
            <p>{result.overview}</p>

            <h3>How to play</h3>
            <pre className="mono-block">{result.howToPlay}</pre>

            <h3>Inspector / police inspector segments</h3>
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
