export type Page =
  | "dashboard"
  | "roster"
  | "profile"
  | "breeding"
  | "health"
  | "supplies"
  | "reports"
  | "flock-records"
  | "more"
  | "assistant";
export type ModalKind =
  "bird" | "health" | "breeding" | "supply" | "reminder" | "pen" | "flock" | "flock-task" | "egg-collection";

export interface Versioned {
  version?: number;
}
export interface Bird extends Versioned {
  id: string;
  name: string;
  breed: string;
  bloodline: string;
  flockId?: string;
  sex: "Male" | "Female";
  color: string;
  hatchDate: string;
  weight: number;
  status: "Active" | "Sold" | "Deceased" | "Brood";
  penId: string;
  sireId: string;
  damId: string;
  breeder: string;
  pedigreeNotes: string;
  breedingId?: string;
  photoPath?: string;
  photo?: string;
}
export interface Flock extends Versioned {
  id: string;
  name: string;
}
export interface FlockTask extends Versioned {
  id: string;
  flockId: string;
  name: string;
}
export interface FlockCheck extends Versioned {
  id: string;
  taskId: string;
  date: string;
}
export interface EggCollection extends Versioned {
  id: string;
  flockId: string;
  date: string;
  count: number;
  notes: string;
}
export interface Pen extends Versioned {
  id: string;
  name: string;
}
export interface BreedingRecord extends Versioned {
  id: string;
  sireId: string;
  damId: string;
  matingDate: string;
  eggsCount: number;
  hatchedCount: number;
  notes: string;
}
export interface HealthLog extends Versioned {
  id: string;
  targetType: "bird" | "pen";
  targetId: string;
  category: "Vaccination" | "Vitamin" | "Medication" | "Routine care";
  date: string;
  notes: string;
}
export interface Reminder extends Versioned {
  id: string;
  birdId: string;
  description: string;
  dueDate: string;
  done: boolean;
}
export interface Supply extends Versioned {
  id: string;
  name: string;
  category: "Feed" | "Vitamin" | "Medicine" | "Equipment";
  quantity: number;
  unit: string;
  reorderLevel: number;
}
