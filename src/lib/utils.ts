import type { Bird, MatchRecord } from "./types";

export const BLOODLINES = [
  "Sweater",
  "Hatch",
  "Kelso",
  "Roundhead",
  "Asil",
  "Radio",
  "Lemon 84",
  "Claret",
  "Grey",
  "Butcher",
  "Albany",
  "Blueface",
  "Other",
];
export const farmDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const today = () => farmDate(new Date());
export function offsetDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return farmDate(date);
}
export function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}
export function age(value: string) {
  if (!value) return "—";
  const birth = new Date(value + "T12:00:00");
  const now = new Date(today() + "T12:00:00");
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) return "Not hatched";
  if (months < 12) return months + (months === 1 ? " month" : " months");
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return (
    years +
    (years === 1 ? " year" : " years") +
    (remaining
      ? ", " + remaining + (remaining === 1 ? " month" : " months")
      : "")
  );
}
export function birdName(birds: Bird[], id: string) {
  return birds.find((bird) => bird.id === id)?.name || "Unknown bird";
}
export function recordFor(birdId: string, matches: MatchRecord[]) {
  const finished = matches.filter(
    (match) =>
      match.outcome !== "Pending" &&
      (match.birdAId === birdId || match.birdBId === birdId),
  );
  const wins = finished.filter((match) => match.winnerId === birdId).length;
  const draws = finished.filter((match) => match.outcome === "Draw").length;
  const losses = finished.length - wins - draws;
  return {
    wins,
    losses,
    draws,
    rate:
      finished.length - draws
        ? Math.round((wins / (finished.length - draws)) * 100)
        : 0,
  };
}
export function makeId(prefix: string) {
  return prefix + "-" + crypto.randomUUID().toUpperCase();
}
