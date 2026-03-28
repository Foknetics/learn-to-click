import { Assignment } from '@learn-to-click/shared';

/**
 * Parses Foji weak aura assignment format.
 * Format: "1-Name1,Name2,Name3,Name4,Name5,2-Name6,Name7,...,5-"
 * Each number represents a clicking team (1-5).
 * Each team has up to 5 player names (one per cube position).
 */
export function parseFojiString(fojiString: string): Assignment[] {
  const assignments: Assignment[] = [];
  const trimmed = fojiString.trim();
  if (!trimmed) return assignments;

  // Split on the pattern "N-" where N is a digit, keeping the digit
  const parts = trimmed.split(/(\d+)-/);

  // parts looks like: ["", "1", "names,", "2", "names,", ...]
  // Index 0 is empty (before first match), then alternating: digit, content
  for (let i = 1; i < parts.length; i += 2) {
    const teamNumber = parseInt(parts[i], 10);
    const namesPart = parts[i + 1] || '';

    const players = namesPart
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (players.length > 0) {
      assignments.push({
        team: teamNumber,
        players,
      });
    }
  }

  return assignments;
}
