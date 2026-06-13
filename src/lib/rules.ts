import { EditableTags } from "./track-row";

// ——— config schema ———
//
// The rules file (rules.json in the app config dir) is hand-editable JSON:
//   { "rules": [ { "field": "track_number", "op": "pad", "width": 2 }, … ] }
// Any extra keys (e.g. "_README") are ignored.

export type RuleOp = "blank" | "set" | "pad" | "yearOnly" | "trim";

export interface Rule {
  field: string;
  op: RuleOp;
  value?: string; // for "set"
  width?: number; // for "pad"
}

export interface RuleSet {
  rules: Rule[];
}

export interface ParsedRules {
  ruleset: RuleSet;
  warnings: string[]; // non-fatal: skipped/invalid rules
}

// Maps user-friendly field names (and the raw EditableTags keys) to tag keys.
const FIELD_MAP: Record<string, keyof EditableTags> = {
  title: "title",
  artist: "artist",
  album: "album",
  album_artist: "albumArtist",
  year: "year",
  year_legacy: "yearLegacy",
  release_date: "releaseDate",
  original_release_date: "originalReleaseDate",
  genre: "genre",
  track_number: "trackNo",
  disc_number: "discNo",
  composer: "composer",
  bpm: "bpm",
  comment: "comment",
  description: "description",
  lyricist: "lyricist",
  conductor: "conductor",
  arranger: "arranger",
  remixer: "remixer",
  copyright: "copyright",
  encoded_by: "encodedBy",
  sort_title: "sortTitle",
  sort_artist: "sortArtist",
  sort_album: "sortAlbum",
  sort_album_artist: "sortAlbumArtist",
};

const VALID_OPS: RuleOp[] = ["blank", "set", "pad", "yearOnly", "trim"];

function resolveField(name: unknown): keyof EditableTags | null {
  if (typeof name !== "string") return null;
  if (name in FIELD_MAP) return FIELD_MAP[name];
  // also accept the raw camelCase EditableTags key
  if ((Object.values(FIELD_MAP) as string[]).includes(name)) return name as keyof EditableTags;
  return null;
}

// Parses and validates the raw config string. Throws only on JSON syntax errors
// or a missing/!array "rules"; individual bad rules become warnings and are skipped.
export function parseRuleSet(raw: string): ParsedRules {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`not valid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  if (typeof data !== "object" || data === null || !Array.isArray((data as any).rules)) {
    throw new Error('missing a "rules" array');
  }

  const warnings: string[] = [];
  const rules: Rule[] = [];

  (data as any).rules.forEach((r: any, i: number) => {
    const label = `rule ${i + 1}`;
    if (typeof r !== "object" || r === null) {
      warnings.push(`${label}: not an object — skipped`);
      return;
    }
    if (resolveField(r.field) === null) {
      warnings.push(`${label}: unknown field "${r.field}" — skipped`);
      return;
    }
    if (!VALID_OPS.includes(r.op)) {
      warnings.push(`${label}: unknown op "${r.op}" — skipped`);
      return;
    }
    if (r.op === "pad" && !(typeof r.width === "number" && r.width > 0)) {
      warnings.push(`${label}: "pad" needs a positive "width" — skipped`);
      return;
    }
    rules.push({ field: r.field, op: r.op, value: r.value, width: r.width });
  });

  return { ruleset: { rules }, warnings };
}

// ——— value transforms ———

// Zero-pads each numeric segment of a value. "3" -> "03", "3/12" -> "03/12".
// Non-numeric segments (and empty values) are left untouched.
function pad(value: string, width: number): string {
  if (!value.trim()) return value;
  return value
    .split("/")
    .map((part) => {
      const t = part.trim();
      return /^\d+$/.test(t) ? t.padStart(width, "0") : part;
    })
    .join("/");
}

// Extracts the first 4-digit run as the year. "2021-05-13" -> "2021",
// "13/05/2021" -> "2021". Leaves the value unchanged if no 4-digit run exists.
function yearOnly(value: string): string {
  const m = value.match(/\d{4}/);
  return m ? m[0] : value;
}

function applyOp(value: string, rule: Rule): string {
  switch (rule.op) {
    case "blank":
      return "";
    case "set":
      return rule.value ?? "";
    case "trim":
      return value.trim();
    case "pad":
      return pad(value, rule.width ?? 2);
    case "yearOnly":
      return yearOnly(value);
  }
}

// Applies every rule (top to bottom) to a copy of the tags, returning the result.
export function applyRulesToTags(tags: EditableTags, ruleset: RuleSet): EditableTags {
  const next = { ...tags };
  for (const rule of ruleset.rules) {
    const key = resolveField(rule.field);
    if (!key) continue;
    next[key] = applyOp(next[key], rule);
  }
  return next;
}
