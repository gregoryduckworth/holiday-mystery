import jsPDF from "jspdf";
import type { CharacterScript, InspectorSegment } from "../types";

function addWrappedText(
  doc: jsPDF,
  text: string,
  cursor: { y: number },
  opts?: { bold?: boolean }
) {
  const marginLeft = 14;
  const maxWidth = 180;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    if (cursor.y > 280) {
      doc.addPage();
      cursor.y = 16;
    }
    doc.text(line, marginLeft, cursor.y);
    cursor.y += 6;
  }
  cursor.y += 2;
}

export function buildCharacterScriptPdf(character: CharacterScript): void {
  const doc = new jsPDF();
  const cursor = { y: 16 };
  const playerLabel = character.playerName || "Player";

  doc.setFontSize(18);
  addWrappedText(doc, `${playerLabel} as ${character.characterName}`, cursor, {
    bold: true,
  });

  doc.setFontSize(12);
  addWrappedText(doc, "What to wear:", cursor, { bold: true });
  addWrappedText(doc, character.costumeDescription, cursor);

  addWrappedText(doc, "Personality:", cursor, { bold: true });
  addWrappedText(doc, character.personality, cursor);

  addWrappedText(doc, "Private backstory (do not share with others):", cursor, {
    bold: true,
  });
  addWrappedText(doc, character.secretBackstory, cursor);

  addWrappedText(doc, "Round-by-round lines:", cursor, { bold: true });
  character.perRoundLines.forEach((raw, index) => {
    addWrappedText(doc, `Round ${index + 1}:`, cursor, { bold: true });
    const segments = raw.split(/\r?\n/).filter(Boolean);
    segments.forEach((segment) => addWrappedText(doc, `• ${segment}`, cursor));
    cursor.y += 2;
  });

  const safeName = (playerLabel || "player")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  doc.save(`${safeName}-script.pdf`);
}

export function buildInspectorPdf(segments: InspectorSegment[]): void {
  const doc = new jsPDF();
  const cursor = { y: 16 };

  doc.setFontSize(18);
  addWrappedText(doc, `Inspector / Police inspector segments`, cursor, {
    bold: true,
  });
  doc.setFontSize(12);
  addWrappedText(
    doc,
    "(Contains answers — reveal only to the game master)",
    cursor
  );

  segments.forEach((seg) => {
    addWrappedText(doc, `Round ${seg.round}: ${seg.title}`, cursor, {
      bold: true,
    });
    addWrappedText(doc, seg.description || "", cursor);
    cursor.y += 4;
  });

  doc.save(`inspector.pdf`);
}
