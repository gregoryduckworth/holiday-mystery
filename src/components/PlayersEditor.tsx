import React from "react";
import type { Player } from "../types";

type Props = {
  players: Player[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, field: keyof Player, value: string) => void;
};

const PlayersEditor: React.FC<Props> = ({
  players,
  onAdd,
  onRemove,
  onUpdate,
}) => {
  return (
    <section className="panel players-panel">
      <div className="panel-header-row">
        <h2>Players &amp; characters</h2>
        <button type="button" className="secondary-button" onClick={onAdd}>
          + Add player
        </button>
      </div>

      <div className="panel-body">
        <p className="hint">
          Add everyone who will play. The generator will tailor character roles,
          costumes, and personalities to them.
        </p>

        <div className="players-grid">
          {players.map((player, index) => (
            <div key={player.id} className="player-card">
              <div className="player-card-header">
                <h3>Player {index + 1}</h3>
                {players.length > 2 && (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onRemove(player.id)}
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
                  onChange={(e) => onUpdate(player.id, "name", e.target.value)}
                />
              </label>

              <label className="field">
                <span>Age group</span>
                <select
                  value={player.age}
                  onChange={(e) => onUpdate(player.id, "age", e.target.value)}
                >
                  <option value="adult">Adult</option>
                  <option value="child">Child</option>
                </select>
              </label>

              <label className="field">
                <span>Sex</span>
                <select
                  value={player.sex}
                  onChange={(e) => onUpdate(player.id, "sex", e.target.value)}
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlayersEditor;
