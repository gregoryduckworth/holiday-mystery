export const HolidayOptions = [
  "Christmas",
  "New Year",
  "Hannukah",
  "Kwanzaa",
  "Winter Solstice",
  "Other",
] as const;

export type HolidayOption = (typeof HolidayOptions)[number];

export interface Player {
  id: number;
  name: string;
  age: "adult" | "child";
  sex: "M" | "F" | "Prefer not to say";
}

export interface MysteryConfig {
  holiday: HolidayOption;
  customHoliday: string;
  locationCoords?: { lat: number; lon: number };
  location: string;
  enableWikiEnrichment?: boolean;
  rounds: number;
  settingNotes: string;
  tone: "light" | "mixed" | "serious";
  players: Player[];
}

export interface LocalEnrichment {
  canonicalName?: string;
  country?: string;
  admin?: string[];
  population?: number | null;
  timezone?: string | null;
  elevationMeters?: number | null;
  coordinates?: { lat: number; lon: number } | null;
  topPOIs?: Array<{ name: string; type: string; distanceMeters?: number }>;
  primaryPOI?: {
    name: string;
    type: string;
    distanceMeters?: number;
    wikidata?: string;
    wikipedia?: string;
  } | null;
  notableFacts?: string[];
  currentWeather?: {
    tempC?: number;
    condition?: string;
    sunrise?: string;
    sunset?: string;
  } | null;
  wikiTitle?: string | null;
}

export interface CharacterScript {
  playerName: string;
  characterName: string;
  costumeDescription: string;
  personality: string;
  secretBackstory: string;
  perRoundLines: string[];
}

export interface InspectorSegment {
  round: number;
  title: string;
  description: string;
}

export interface MysteryScriptResult {
  overview: string;
  howToPlay: string;
  characters: CharacterScript[];
  inspectorSegments: InspectorSegment[];
  finalGuessInstructions: string;
}
