import type { MhcClass, Species } from "./api";

export const MHC_CLASSES: { value: MhcClass; label: string }[] = [
  { value: "I", label: "MHC class I" },
  { value: "II", label: "MHC class II" },
];

export const SPECIES: { value: Species; label: string }[] = [
  { value: "human", label: "Human" },
  { value: "humanized", label: "Humanized" },
  { value: "mouse", label: "Mouse" },
  { value: "rat", label: "Rat" },
  { value: "swine", label: "Swine" },
  { value: "bovine", label: "Bovine" },
  { value: "chicken", label: "Chicken" },
  { value: "dog", label: "Dog" },
];
