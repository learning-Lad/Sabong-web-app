import type { Bird, BreedingRecord } from "./types";
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T12:00:00")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function numberError(value: unknown, integer = false) {
  const n = Number(value);
  return (
    value === "" ||
    !Number.isFinite(n) ||
    n < 0 ||
    (integer && !Number.isInteger(n))
  );
}
export function validateBird(
  bird: Bird,
  birds: Bird[],
  pairings: BreedingRecord[],
  today: string,
) {
  const errors: Record<string, string> = {};
  for (const key of ["name", "breed", "color"] as const)
    if (!bird[key].trim()) errors[key] = "This field is required.";
  if (!validDate(bird.hatchDate) || bird.hatchDate > today)
    errors.hatchDate = "Choose a valid hatch date that is not in the future.";
  if (!Number.isFinite(bird.weight) || bird.weight < 0 || bird.weight >= 100)
    errors.weight = "Enter a weight between 0 and 99.99 kg.";
  const visited = new Set<string>();
  const ancestry = (id: string): boolean => {
    if (id === bird.id) return true;
    if (!id || visited.has(id)) return false;
    visited.add(id);
    const parent = birds.find((item) => item.id === id);
    return !!parent && (ancestry(parent.sireId) || ancestry(parent.damId));
  };
  for (const [key, sex] of [
    ["sireId", "Male"],
    ["damId", "Female"],
  ] as const) {
    const id = bird[key];
    if (!id) continue;
    const parent = birds.find((item) => item.id === id);
    if (!parent || parent.sex !== sex)
      errors[key] = "Choose a parent with the correct sex from your farm.";
    else if (parent.hatchDate >= bird.hatchDate)
      errors[key] = "A parent must hatch before this bird.";
    else if (ancestry(id))
      errors[key] = "This parent would create a pedigree cycle.";
  }
  if (bird.breedingId) {
    const pair = pairings.find((item) => item.id === bird.breedingId);
    if (
      !pair ||
      pair.sireId !== bird.sireId ||
      pair.damId !== bird.damId ||
      pair.matingDate > bird.hatchDate
    )
      errors.breedingId =
        "Choose a matching pairing dated before the hatch date.";
  }
  return errors;
}
