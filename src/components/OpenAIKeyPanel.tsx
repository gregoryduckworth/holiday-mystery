import React from "react";

type Props = {
  openaiKey: string;
  setOpenaiKey: (v: string) => void;
  showOpenaiKey: boolean;
  setShowOpenaiKey: (fn: (prev: boolean) => boolean) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  envKeyPresent: boolean;
};

const OpenAIKeyPanel: React.FC<Props> = ({
  openaiKey,
  setOpenaiKey,
  showOpenaiKey,
  setShowOpenaiKey,
  selectedModel,
  setSelectedModel,
  envKeyPresent,
}) => {
  return (
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
                    setShowOpenaiKey(() => false);
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
                  <option value="gpt-4.1-mini">gpt-4.1-mini (default)</option>
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
              The key stays in memory for this session only and is not saved to
              disk.
            </small>
          </div>
        </label>
      </div>
    </section>
  );
};

export default OpenAIKeyPanel;
