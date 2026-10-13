import type { MhcClass, Species } from "./api";

// `value` doubles as the parquet filename stem the backend resolves: the API
// turns it into `<value>_class<I|II>.parquet` (see `runner.py::database_path`).
// It must therefore never be renamed to match a display label — that is why
// `dogsl` is shown as "Dog". `label` is the only user-visible form; keep it
// consistent with the prose on Home/FAQ by going through `speciesLabelList()`
// instead of spelling the species out again.
//
// `classes` lists only the MHC classes that actually have peptide data for that
// species in the production database — `humanized_classI.parquet` exists but is
// empty, and bovine/swine/rat/dogsl have no classII file at all. Keeping this in
// sync with `backend/bio-database/` avoids landing the user on a species+class
// combination with no alleles to select.
export const ANALYSIS_SPECIES: Array<{ value: Species; label: string; hasExpression: boolean; classes: MhcClass[] }> = [
  { value: "human", label: "Human", hasExpression: true, classes: ["I", "II"] },
  { value: "mouse", label: "Mouse", hasExpression: false, classes: ["I", "II"] },
  { value: "rat", label: "Rat", hasExpression: false, classes: ["I"] },
  { value: "bovine", label: "Cattle", hasExpression: false, classes: ["I"] },
  { value: "chicken", label: "Chicken", hasExpression: false, classes: ["I", "II"] },
  { value: "dogsl", label: "Dog", hasExpression: false, classes: ["I"] },
  { value: "swine", label: "Pig", hasExpression: false, classes: ["I"] },
  { value: "humanized", label: "Humanized mouse", hasExpression: false, classes: ["II"] },
];

export const MHC_CLASSES: Array<{ value: MhcClass; label: string }> = [
  { value: "I", label: "MHC class I" },
  { value: "II", label: "MHC class II" },
];

/** Display label for a species value, falling back to the raw value if unknown. */
export function speciesLabel(value: Species | string): string {
  return ANALYSIS_SPECIES.find((item) => item.value === value)?.label ?? String(value);
}

/**
 * Species labels as a prose list, so user-facing copy never hardcodes the set.
 * `lowercase` suits mid-sentence use ("... for mouse, rat, cattle, ... backgrounds");
 * the default keeps the dropdown's own capitalization for list items and headings.
 */
export function speciesLabelList(
  options: { exclude?: Species[]; conjunction?: "and" | "or"; lowercase?: boolean } = {},
): string {
  const { exclude = [], conjunction = "and", lowercase = false } = options;
  const labels = ANALYSIS_SPECIES
    .filter((item) => !exclude.includes(item.value))
    .map((item) => (lowercase ? item.label.toLowerCase() : item.label));
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} ${conjunction} ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, ${conjunction} ${labels[labels.length - 1]}`;
}
