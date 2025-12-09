import React from "react";
import type { LocalEnrichment } from "../types";
import type { WikiSummary } from "../lib/wiki";

type Props = {
  enableWikiEnrichment?: boolean;
  wikiLoading: boolean;
  wikiError: string | null;
  wikiPreview: WikiSummary | null;
  onRefreshWiki: () => void;
  localLoading: boolean;
  localError: string | null;
  localPreview: LocalEnrichment | null;
  selectedPOIs: Array<{ name: string; type?: string; distanceMeters?: number }>;
  setSelectedPOIs: React.Dispatch<
    React.SetStateAction<
      Array<{ name: string; type?: string; distanceMeters?: number }>
    >
  >;
};

const LocationPreviewPanel: React.FC<Props> = ({
  enableWikiEnrichment,
  wikiLoading,
  wikiError,
  wikiPreview,
  onRefreshWiki,
  localLoading,
  localError,
  localPreview,
  selectedPOIs,
  setSelectedPOIs,
}) => {
  return (
    <section className="panel">
      <h2>Location preview</h2>
      <p className="hint">Preview the Wikipedia summary for the location.</p>

      <div className="wiki-preview">
        {enableWikiEnrichment ? (
          wikiLoading ? (
            <div className="wiki-loader" role="status" aria-live="polite">
              <div className="wiki-spinner" aria-hidden="true" />
              <div className="wiki-loader-text">Loading Wikipedia summary…</div>
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
                  onClick={onRefreshWiki}
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
                                      !(s.name === p.name && s.type === p.type)
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
  );
};

export default LocationPreviewPanel;
