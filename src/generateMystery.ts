import { createOpenAIClient } from "./openaiClient";
import { fetchWikiSummaryByTitle } from "./lib/wiki";
import getLocalEnrichment from "./lib/localEnrich";
import type { MysteryConfig, MysteryScriptResult } from "./types";

// selectedPOIs: optional array of POI names (with optional meta) that the user
// has chosen to be explicitly available to the generator as location prompts.
export async function generateMysteryScript(
  config: MysteryConfig,
  selectedPOIs?: Array<{ name: string; type?: string; distanceMeters?: number }>
): Promise<MysteryScriptResult> {
  const client = createOpenAIClient();

  const holidayLabel =
    config.holiday === "Other" && config.customHoliday
      ? config.customHoliday
      : config.holiday;

  const playersDescription = config.players
    .map(
      (p, index) =>
        `- Player ${index + 1}: age group ${p.age || "unspecified"}, sex ${
          p.sex || "unspecified"
        }. Create a unique fictional character for this player that matches this sex when it is M or F, or is gender-neutral when marked "Prefer not to say".`
    )
    .join("\n");

  const locationHint = config.location
    ? `Location for the story setting: ${config.location}

Location usage rules:
- Clearly set the mystery in or near this location.
- Use local-sounding details: weather, typical holiday decorations, foods, or traditions that could plausibly match this place.
- You may invent cosy, fictional local events (like a lights festival or holiday fair) that fit the tone.
- You may invent place names (streets, parks, squares, or landmarks) that *sound* right for this location.
- Avoid real-world tragedies, politics, actual crimes, or controversial news.
- Keep all references light, cosy, playful, and family-friendly.`
    : `No specific location provided. Choose a generic, cosy setting that fits the holiday and tone.`;

  // Try to enrich the location with a short Wikipedia summary if we have a place name.
  let wikiLocationNote = "";
  if (config.location) {
    try {
      const wiki = await fetchWikiSummaryByTitle(config.location);
      if (wiki && wiki.extract) {
        const oneLine = wiki.extract.split(". ").slice(0, 4).join(". ");
        wikiLocationNote = `\n\nLocation note (from Wikipedia): ${oneLine}.`;
      }
    } catch (err) {
      console.warn("[generateMysteryScript] Wiki enrichment failed:", err);
    }
  }

  // Try to enrich with nearby POIs / weather from OpenStreetMap / Open-Meteo when coordinates are available.
  let localEnrichmentNote = "";
  let poiUsageInstructions = "";
  try {
    const lat = config.locationCoords?.lat;
    const lon = config.locationCoords?.lon;
    if (typeof lat === "number" && typeof lon === "number") {
      try {
        const le = await getLocalEnrichment({
          lat,
          lon,
          name: config.location,
        });
        try {
          /* intentionally not logging local enrichment results */
        } catch {
          /* ignore */
        }
        if (le) {
          const poiList = (le.topPOIs || [])
            .slice(0, 6)
            .map((p) => `${p.name} (${p.type})`)
            .join("; ");
          const weather = le.currentWeather?.tempC
            ? `Weather around ${le.currentWeather.tempC}°C.`
            : "";
          const pop = le.population
            ? `Population approx ${le.population}.`
            : "";
          const admin = (le.admin || []).join(", ");
          const adminNote = admin ? `Located in ${admin}.` : "";
          localEnrichmentNote = `\n\nLocal context (from OSM/Open-Meteo): ${adminNote} ${pop} ${weather} Nearby notable places: ${poiList}.`;
          // If we have POIs, add explicit instructions asking the model to use some as clue locations
          const pois = (le.topPOIs || []).slice(0, 6);
          if (pois.length > 0) {
            const poiLines = pois
              .map(
                (p) =>
                  `${p.name} (${p.type})${
                    p.distanceMeters ? `, ${p.distanceMeters}m` : ""
                  }`
              )
              .join("; ");
            // If the caller supplied explicit selected POIs, add a short note asking
            // the model to prioritise them. This helps designers pick which nearby
            // places should be used as clue locations.
            let selectedNote = "";
            if (Array.isArray(selectedPOIs) && selectedPOIs.length > 0) {
              const selList = selectedPOIs
                .map((s) => `${s.name}${s.type ? ` (${s.type})` : ""}`)
                .join("; ");
              selectedNote = `\n- Prioritise these selected places as clue locations: ${selList}.`;
            }

            poiUsageInstructions = `\n\nLocal POI usage rules:\n- Prefer using 2–4 of the nearby places as specific clue locations (use their names exactly as listed: ${poiLines}).${selectedNote}\n- Place physical clues, props, or important conversation prompts at those POIs (for example: "a ribbon found near Old Mill Pub", "a torn program from the Winter Fair at Market Square").\n- When mentioning a POI, optionally include a brief distance (e.g., ~200m) to ground the scene, but do NOT include real addresses or precise GPS coordinates.\n- Ensure at least one round includes dialog or an inspector note that directs players to examine or discuss a named POI.\n`;
          }
        }
      } catch (err) {
        console.warn("[generateMysteryScript] Local enrichment failed:", err);
      }
    }
  } catch (err) {
    console.warn("[generateMysteryScript] Local enrichment error:", err);
  }

  const system =
    "You are an expert writer of fun mystery party games. " +
    "You always create clear scripts that can be read aloud by children and adults. " +
    "Use short sentences, easy words, and avoid anything scary or violent if children are playing.";

  const userPrompt = `Create a holiday mystery party game in English with the following requirements:

Holiday / occasion: ${holidayLabel}
Tone: ${config.tone}
Number of rounds: ${config.rounds}

Players (create one fictional character per listed player):
${playersDescription}

${locationHint}

${wikiLocationNote}
${localEnrichmentNote}
${poiUsageInstructions}

Additional notes from the organiser:
${config.settingNotes || "None provided."}

You MUST generate a mystery title that fits the holiday or occasion.

Rules for the title:
- It must clearly match: ${holidayLabel}.
- It must feel playful and suitable for ages 9–12.
- It should sound like the name of a fun mystery party.
- Do NOT ask the user for a title; create it automatically.

Structure the result as concise JSON matching this TypeScript type:

type CharacterScript = {
  playerName: string; // copy from input list (real name; NOT for use in the script)
  characterName: string; // the in-story persona; ALWAYS use this name in the script
  costumeDescription: string;
  personality: string;
  secretBackstory: string;
  perRoundLines: string[]; // one entry per round, formatted mini-scripts
};

type InspectorSegment = {
  round: number;
  title: string;
  description: string; // The inspector speaks: wrap-up of previous round + prompts for next round
};

type MysteryScriptResult = {
  title: string;
  overview: string;
  howToPlay: string;
  characters: CharacterScript[];
  inspectorSegments: InspectorSegment[];
  finalGuessInstructions: string;
};

Important constraints:
- You will NOT receive real player names. NEVER invent or request them.
- NEVER use "playerName" in dialogue. ONLY use "characterName" in the script.
- Each character must have one perRoundLines entry for each round.
- Each perRoundLines entry must be a properly formatted multi-line mini-script.
- Each entry MUST begin with:
  "Round X – things to say and talk about:\\n"
- After the label, output MANY short lines, each on its own line, starting with:
  "You say:" or "You can talk about:"
- Each line MUST be separated with a visible "\\n".
- Include 6–10 lines per round.
- Dialogue must always reference other characters by characterName.
- The mystery must be solvable from clues.
- Tone: playful, friendly, easy for ages 9–12.

Game flow and rules:
- In "howToPlay", first include a short, neutral introduction by a host or narrator who is NOT a suspect, welcoming everyone and setting the scene in 2–3 short paragraphs.
- After the introduction, clearly explain how the rounds work: players read their character sheets, then in each round they reveal new lines and clues by talking in character.
- Explain how and when the inspector segments should be read between rounds.
- Make it clear that no one should reveal the final solution until after the guessing phase at the end.
- "finalGuessInstructions" must describe exactly when to pause the story, let everyone write or say their guess, and how to then hear the final inspector wrap-up and solution.

Inspector guidance:
- For each round, provide a short wrap-up of what happened in the previous round.
- Then give the players new hints, questions, or observations to prompt conversation for the next round.
- Keep it playful, fun, and not too obvious; do NOT reveal the full solution until the last round.
 - Example: "Inspector says: Last round, you noticed the decorations were slightly out of place. Perhaps someone moved quickly near the tree. Talk to each other and see what you can figure out!"
 - The VERY LAST entry in "inspectorSegments" must happen AFTER the players' guessing phase described in "finalGuessInstructions" and must fully wrap up the story.

Additional generation guidance:
- Create a full mystery premise.
- 3–5 characters.
- 2–4 rounds.
- Hidden clues across dialogue and inspector text.
- Only reveal the solution at the very end.
- The final inspector segment in "inspectorSegments" must fully wrap up the story and clearly reveal:
  - Who was behind the mystery.
  - How they did it.
  - Which clues pointed to them.
  This full reveal must live ONLY in the last inspector segment, not in player dialogue.
- Output ONLY valid JSON. No commentary or extra text.

IMPORTANT:
- Output **ONLY JSON**, starting with \`{\` and ending with \`}\`.
- Do NOT include any explanations, notes, or markdown.
- Escape all newlines inside strings as \\n.`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });

  // raw response intentionally not logged

  let rawText: string | null =
    (response as unknown as { output_text?: string | null }).output_text ??
    null;

  if (
    !rawText &&
    Array.isArray((response as unknown as { output?: unknown[] }).output)
  ) {
    const pieces: string[] = [];
    for (const item of (
      response as unknown as {
        output: Array<{
          type: string;
          content?: Array<{ type: string; text?: string }>;
        }>;
      }
    ).output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === "output_text" && typeof c.text === "string") {
            pieces.push(c.text);
          }
        }
      }
    }
    rawText = pieces.join("\n") || null;
  }

  if (!rawText) {
    throw new Error("OpenAI did not return any text output to parse.");
  }

  // raw text output intentionally not logged

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error("[generateMysteryScript] Failed to parse JSON:", err);
    console.error("[generateMysteryScript] Problematic text was:", rawText);
    throw new Error("The model returned invalid JSON for the mystery script.");
  }

  const baseResult = parsed as MysteryScriptResult;

  const remappedCharacters = baseResult.characters.map((ch, index) => {
    const realPlayer = config.players[index];
    return {
      ...ch,
      playerName: realPlayer?.name || ch.playerName || `Player ${index + 1}`,
    };
  });

  return {
    ...baseResult,
    characters: remappedCharacters,
  };
}
