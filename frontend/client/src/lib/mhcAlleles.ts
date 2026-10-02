import type { MhcClass, Species } from "./api";

// `classes` lists only the MHC classes that actually have peptide data for
// that species in the production database (e.g. humanized_classI.parquet
// and the *_classII.parquet files for bovine/swine/rat/dogsl don't exist or
// are empty). Keeping this in sync with `backend/bio-database/` avoids
// landing the user on a species+class combination with no alleles to select.
export const ANALYSIS_SPECIES: Array<{ value: Species; label: string; hasExpression: boolean; classes: MhcClass[] }> = [
  { value: "human", label: "Human", hasExpression: true, classes: ["I", "II"] },
  { value: "humanized", label: "Humanized", hasExpression: false, classes: ["II"] },
  { value: "mouse", label: "Mouse", hasExpression: false, classes: ["I", "II"] },
  { value: "bovine", label: "Bovine", hasExpression: false, classes: ["I"] },
  { value: "swine", label: "Swine", hasExpression: false, classes: ["I"] },
  { value: "chicken", label: "Chicken", hasExpression: false, classes: ["I", "II"] },
  { value: "rat", label: "Rat", hasExpression: false, classes: ["I"] },
  { value: "dogsl", label: "Dog", hasExpression: false, classes: ["I"] },
];

export const MHC_CLASSES: Array<{ value: MhcClass; label: string }> = [
  { value: "I", label: "MHC class I" },
  { value: "II", label: "MHC class II" },
];
