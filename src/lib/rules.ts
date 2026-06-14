import { EditableTags } from "./track-row";

// ——— config schema ———
//
// Each rule may use a single op (string) or a list of ops (array):
//
//   { "field": "track_number", "op": "pad", "width": 2 }
//   { "field": "track_number", "op": ["trim", {"op": "pad", "width": 2}] }
//   { "field": "sort_artist",  "op": [{"op": "copy", "from": "artist"}, "trim"] }
//
// Use "*" as the field to apply an op to every field:
//
//   { "field": "*", "op": "trim" }

export type RuleOpName = "blank" | "set" | "pad" | "yearOnly" | "trim" | "copy";
export type RuleOp = RuleOpName; // backward-compat alias

// Resolved, normalized operation — used internally after parsing.
interface OpDef {
  op: RuleOpName;
  value?: string; // "set"
  width?: number; // "pad"
  from?: string; // "copy"
}

export interface Rule {
  field: string;
  ops: OpDef[];
}

export interface RuleSet {
  rules: Rule[];
}

export interface ParsedRules {
  ruleset: RuleSet;
  warnings: string[];
}

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

const VALID_OPS: RuleOpName[] = [
  "blank",
  "set",
  "pad",
  "yearOnly",
  "trim",
  "copy",
];

function resolveField(name: unknown): keyof EditableTags | null {
  if (typeof name !== "string") return null;
  if (name in FIELD_MAP) return FIELD_MAP[name];
  if ((Object.values(FIELD_MAP) as string[]).includes(name))
    return name as keyof EditableTags;
  return null;
}

function validateOpDef(
  r: Record<string, unknown>,
  label: string,
  warnings: string[],
): OpDef | null {
  const op = r.op as RuleOpName;
  if (!VALID_OPS.includes(op)) {
    warnings.push(`${label}: unknown op "${op}" — skipped`);
    return null;
  }
  if (op === "pad" && !(typeof r.width === "number" && r.width > 0)) {
    warnings.push(`${label}: "pad" needs a positive "width" — skipped`);
    return null;
  }
  if (op === "copy" && resolveField(r.from) === null) {
    warnings.push(`${label}: "copy" needs a valid "from" field name — skipped`);
    return null;
  }
  return {
    op,
    value: r.value as string | undefined,
    width: r.width as number | undefined,
    from: r.from as string | undefined,
  };
}

// Parses one item from an op array. Strings are bare op names (for ops that
// need no params); objects use the same {op, ...params} shape as a top-level rule.
function parseOpSpec(
  item: unknown,
  label: string,
  warnings: string[],
): OpDef | null {
  if (typeof item === "string") {
    if (!VALID_OPS.includes(item as RuleOpName)) {
      warnings.push(`${label}: unknown op "${item}" — skipped`);
      return null;
    }
    if (item === "pad" || item === "set" || item === "copy") {
      warnings.push(
        `${label}: "${item}" requires params — use {"op": "${item}", ...} — skipped`,
      );
      return null;
    }
    return { op: item as RuleOpName };
  }
  if (typeof item === "object" && item !== null) {
    return validateOpDef(item as Record<string, unknown>, label, warnings);
  }
  warnings.push(`${label}: op must be a string or object — skipped`);
  return null;
}

// Parses and validates the raw config string. Throws only on JSON syntax errors
// or a missing/!array "rules"; individual bad rules become warnings and are skipped.
export function parseRuleSet(raw: string): ParsedRules {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `not valid JSON (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as any).rules)
  ) {
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
    if (r.field !== "*" && resolveField(r.field) === null) {
      warnings.push(`${label}: unknown field "${r.field}" — skipped`);
      return;
    }

    const ops: OpDef[] = [];

    if (Array.isArray(r.op)) {
      r.op.forEach((item: unknown, j: number) => {
        const def = parseOpSpec(item, `${label} op[${j + 1}]`, warnings);
        if (def) ops.push(def);
      });
    } else {
      const def = validateOpDef(r, label, warnings);
      if (def) ops.push(def);
    }

    if (ops.length > 0) rules.push({ field: r.field, ops });
  });

  return { ruleset: { rules }, warnings };
}

// ——— value transforms ———

// Zero-pads each numeric segment of a value. "3" -> "03", "3/12" -> "03/12".
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

// Extracts the first 4-digit run as the year. "2021-05-13" -> "2021".
function yearOnly(value: string): string {
  const m = value.match(/\d{4}/);
  return m ? m[0] : value;
}

// tags is the in-progress state so copy picks up values already modified by
// earlier rules in the same run.
function applyOp(value: string, def: OpDef, tags: EditableTags): string {
  switch (def.op) {
    case "blank":
      return "";
    case "set":
      return def.value ?? "";
    case "trim":
      return value.trim();
    case "pad":
      return pad(value, def.width ?? 2);
    case "yearOnly":
      return yearOnly(value);
    case "copy": {
      const srcKey = resolveField(def.from ?? "");
      return srcKey !== null ? tags[srcKey] : value;
    }
  }
}

const ALL_FIELDS = [...new Set(Object.values(FIELD_MAP))];

// Applies every rule (top to bottom) to a copy of the tags, returning the result.
export function applyRulesToTags(
  tags: EditableTags,
  ruleset: RuleSet,
): EditableTags {
  const next = { ...tags };
  for (const rule of ruleset.rules) {
    const keys: (keyof EditableTags)[] =
      rule.field === "*"
        ? ALL_FIELDS
        : [resolveField(rule.field)].filter(
            (k): k is keyof EditableTags => k !== null,
          );
    for (const key of keys) {
      for (const def of rule.ops) {
        next[key] = applyOp(next[key], def, next);
      }
    }
  }
  return next;
}
