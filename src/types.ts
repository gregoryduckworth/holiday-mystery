export type HolidayOption =
  | "Christmas"
  | "Halloween"
  | "New Year"
  | "Valentines Day"
  | "Easter"
  | "Birthday"
  | "Other";

export interface Player {
  id: number;
  name: string;
  age: "adult" | "child";
  sex: "M" | "F" | "Prefer not to say";
}

export interface MysteryConfig {
  holiday: HolidayOption;
  customHoliday: string;
  rounds: number;
  settingNotes: string;
  tone: "light" | "mixed" | "serious";
  players: Player[];
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
