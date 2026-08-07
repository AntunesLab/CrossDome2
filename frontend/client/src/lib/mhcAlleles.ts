import type { MhcClass, Species } from "./api";

export const ANALYSIS_SPECIES: Array<{ value: Species; label: string; hasExpression: boolean }> = [
  { value: "human", label: "Human", hasExpression: true },
  { value: "humanized", label: "Humanized", hasExpression: false },
  { value: "mouse", label: "Mouse", hasExpression: false },
  { value: "bovine", label: "Bovine", hasExpression: false },
  { value: "swine", label: "Swine", hasExpression: false },
  { value: "chicken", label: "Chicken", hasExpression: false },
  { value: "rat", label: "Rat", hasExpression: false },
  { value: "dogs", label: "Dog", hasExpression: false },
];

export const MHC_CLASSES: Array<{ value: MhcClass; label: string }> = [
  { value: "I", label: "MHC class I" },
  { value: "II", label: "MHC class II" },
];
