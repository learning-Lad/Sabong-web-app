import { demoStore } from "./demo.svelte";
import * as repository from "./repository";
import { cloud } from "./supabase";
import { makeId, today } from "./utils";
import type {
  Bird,
  BreedingRecord,
  HealthLog,
  Flock,
  FlockTask,
  FlockCheck,
  EggCollection,
  Pen,
  Reminder,
  Supply,
} from "./types";
class FarmStore {
  birds = $state<Bird[]>([]);
  pens = $state<Pen[]>([]);
  breeding = $state<BreedingRecord[]>([]);
  health = $state<HealthLog[]>([]);
  reminders = $state<Reminder[]>([]);
  supplies = $state<Supply[]>([]);
  flocks = $state<Flock[]>([]);
  flockTasks = $state<FlockTask[]>([]);
  flockChecks = $state<FlockCheck[]>([]);
  eggCollections = $state<EggCollection[]>([]);
  lowStock = $derived(this.supplies.filter((item) => item.quantity <= item.reorderLevel));
  farmName = $state("My Farm");
  farmId = $state("");
  demo = $state(false);
  busy = $state(false);
  error = $state("");
  photoWarning = $state("");
  private epoch = 0;
  private generation = 0;
  private requireWorkspace(generation: number) {
    if (generation !== this.generation)
      throw new Error(
        "The workspace changed during this request. Refresh before continuing.",
      );
  }
  private photoUrls: string[] = [];
  reset() {
    this.epoch++;
    this.generation++;
    this.photoUrls.forEach((url) => URL.revokeObjectURL(url));
    this.photoUrls = [];
    this.birds = [];
    this.pens = [];
    this.breeding = [];
    this.health = [];
    this.reminders = [];
    this.supplies = [];
    this.flocks = [];
    this.flockTasks = [];
    this.flockChecks = [];
    this.eggCollections = [];
    this.farmId = "";
    this.farmName = "My Farm";
    this.demo = false;
    this.error = "";
    this.photoWarning = "";
    this.busy = false;
  }
  startDemo() {
    this.reset();
    this.demo = true;
    this.farmName = "San Isidro Farm";
    this.birds = structuredClone($state.snapshot(demoStore.birds));
    this.flocks = structuredClone($state.snapshot(demoStore.flocks));
    this.flockTasks = [
      { id: "TASK-1", flockId: "F-1", name: "Check waterers" },
      { id: "TASK-2", flockId: "F-1", name: "Check bedding" },
    ];
    this.eggCollections = [{ id: "EGG-1", flockId: "F-1", date: today(), count: 4, notes: "" }];
    this.pens = structuredClone($state.snapshot(demoStore.pens));
    this.breeding = structuredClone($state.snapshot(demoStore.breeding));
    this.health = structuredClone($state.snapshot(demoStore.health));
    this.reminders = structuredClone($state.snapshot(demoStore.reminders));
    this.supplies = structuredClone($state.snapshot(demoStore.supplies));
  }
  async refresh() {
    if (this.demo) return;
    const epoch = ++this.epoch;
    this.busy = true;
    this.error = "";
    try {
      const { error } = await cloud().rpc("app_touch_session");
      if (error) throw error;
      const { farm, records } = await repository.loadFarm();
      if (epoch !== this.epoch) return;
      this.photoUrls.forEach((url) => URL.revokeObjectURL(url));
      this.photoUrls = [];
      this.farmId = farm.id;
      this.farmName = farm.name;
      this.birds = records.birds.map((bird) => ({
        ...bird,
        flockId: bird.flockId || "",
        penId: bird.penId || "",
        sireId: bird.sireId || "",
        damId: bird.damId || "",
        breedingId: bird.breedingId || "",
      }));
      this.pens = records.pens;
      this.flocks = records.flocks;
      this.flockTasks = records.flock_tasks;
      this.flockChecks = records.flock_checks;
      this.eggCollections = records.egg_collections;
      this.breeding = records.breeding;
      this.health = records.health.sort((a, b) => b.date.localeCompare(a.date));
      this.reminders = records.reminders;
      this.supplies = records.supplies;
      // Photos are private downloads, never public bucket URLs. Don't block manual records on an image failure.
      this.photoWarning = "";
      void Promise.all(
        this.birds
          .filter((bird) => bird.photoPath)
          .map(async (bird) => {
            try {
              const photo = await repository.downloadPhoto(bird.photoPath!);
              if (epoch !== this.epoch) {
                URL.revokeObjectURL(photo);
                return;
              }
              this.photoUrls.push(photo);
              this.birds = this.birds.map((item) =>
                item.id === bird.id ? { ...item, photo } : item,
              );
            } catch {
              if (epoch === this.epoch)
                this.photoWarning =
                  "Some photos could not load. Your records are available; refresh to retry.";
            }
          }),
      );
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  async addBird(bird: Bird) {
    const generation = this.generation;
    const saved = this.demo ? bird : await repository.save("birds", bird);
    this.requireWorkspace(generation);
    this.birds = [{ ...saved, photo: bird.photo }, ...this.birds];
  }
  async updateBird(bird: Bird) {
    const generation = this.generation;
    const saved = this.demo ? bird : await repository.save("birds", bird, true);
    this.requireWorkspace(generation);
    this.birds = this.birds.map((item) =>
      item.id === bird.id ? { ...saved, photo: bird.photo } : item,
    );
  }
  async deleteBird(id: string) {
    const generation = this.generation;
    const bird = this.birds.find((item) => item.id === id);
    if (!bird) return;
    if (!this.demo) await repository.remove("birds", id, bird.version);
    this.requireWorkspace(generation);
    this.birds = this.birds.filter((item) => item.id !== id);
  }
  async saveFlock(name: string, id?: string) {
    const generation = this.generation;
    const existing = this.flocks.find((flock) => flock.id === id);
    if (id && !existing) throw new Error("Refresh records and choose a flock.");
    if (this.flocks.some((flock) => flock.id !== id && flock.name.toLowerCase() === name.toLowerCase()))
      throw new Error("A flock with this name already exists.");
    const record: Flock = existing ? { ...existing, name } : { id: makeId("F"), name };
    const saved = this.demo ? record : await repository.save("flocks", record, !!existing);
    this.requireWorkspace(generation);
    this.flocks = existing
      ? this.flocks.map((flock) => flock.id === saved.id ? saved : flock)
      : [...this.flocks, saved];
    return saved;
  }
  async addFlockTask(flockId: string, name: string) {
    const generation = this.generation;
    if (this.flockTasks.some((task) => task.flockId === flockId && task.name.toLowerCase() === name.toLowerCase()))
      throw new Error("This flock already has a task with that name.");
    const task: FlockTask = { id: makeId("TASK"), flockId, name };
    const saved = this.demo ? task : await repository.save("flock_tasks", task);
    this.requireWorkspace(generation);
    this.flockTasks = [...this.flockTasks, saved];
  }
  async toggleFlockTask(taskId: string, date: string) {
    const generation = this.generation;
    const existing = this.flockChecks.find((entry) => entry.taskId === taskId && entry.date === date);
    if (existing) {
      if (!this.demo) await repository.remove("flock_checks", existing.id, existing.version);
      this.requireWorkspace(generation);
      this.flockChecks = this.flockChecks.filter((entry) => entry.id !== existing.id);
      return;
    }
    const entry: FlockCheck = { id: makeId("CHECK"), taskId, date };
    const saved = this.demo ? entry : await repository.save("flock_checks", entry);
    this.requireWorkspace(generation);
    this.flockChecks = [...this.flockChecks, saved];
  }
  async saveEggCollection(entry: EggCollection, editing: boolean) {
    const generation = this.generation;
    const saved = this.demo ? entry : await repository.save("egg_collections", entry, editing);
    this.requireWorkspace(generation);
    this.eggCollections = editing
      ? this.eggCollections.map((item) => item.id === saved.id ? saved : item)
      : [...this.eggCollections, saved];
  }
  async addPen(name: string) {
    const generation = this.generation;
    let pen: Pen = { id: makeId("P"), name };
    if (!this.demo) pen = await repository.save("pens", pen);
    this.requireWorkspace(generation);
    this.pens = [...this.pens, pen];
    return pen;
  }
  async saveBreeding(record: BreedingRecord) {
    const generation = this.generation;
    const exists = this.breeding.some((item) => item.id === record.id);
    const saved = this.demo
      ? record
      : await repository.save("breeding", record, exists);
    this.requireWorkspace(generation);
    this.breeding = exists
      ? this.breeding.map((item) => (item.id === record.id ? saved : item))
      : [saved, ...this.breeding];
  }
  async addHealth(record: HealthLog, supplyId?: string, quantity = 0) {
    const generation = this.generation;
    if (this.demo && supplyId) {
      const item = this.supplies.find((item) => item.id === supplyId);
      if (!item || quantity <= 0 || quantity > item.quantity)
        throw new Error("Check the quantity used and available stock.");
      await this.adjustSupply(supplyId, -quantity);
    }
    const saved = this.demo
      ? record
      : await repository.logCare(record, supplyId, quantity);
    this.requireWorkspace(generation);
    this.health = [saved, ...this.health];
    if (!this.demo && supplyId)
      await this.refresh().catch(() => {
        this.error =
          "Care log saved, but the latest stock balance could not load. Refresh before the next stock change.";
      });
  }
  async addReminder(record: Reminder) {
    const generation = this.generation;
    const saved = this.demo
      ? record
      : await repository.save("reminders", record);
    this.requireWorkspace(generation);
    this.reminders = [...this.reminders, saved];
  }
  async toggleReminder(id: string) {
    const generation = this.generation;
    const reminder = this.reminders.find((item) => item.id === id);
    if (!reminder) return;
    const updated = { ...reminder, done: !reminder.done };
    const saved = this.demo
      ? updated
      : await repository.save("reminders", updated, true);
    this.requireWorkspace(generation);
    this.reminders = this.reminders.map((item) =>
      item.id === id ? saved : item,
    );
  }
  async saveSupply(item: Supply) {
    const generation = this.generation;
    const exists = this.supplies.some((supply) => supply.id === item.id);
    const saved = this.demo
      ? item
      : await repository.save("supplies", item, exists);
    this.requireWorkspace(generation);
    this.supplies = exists
      ? this.supplies.map((supply) => (supply.id === item.id ? saved : supply))
      : [...this.supplies, saved];
  }
  async adjustSupply(id: string, delta: number) {
    const generation = this.generation;
    const item = this.supplies.find((item) => item.id === id);
    if (!item) throw new Error("Supply not found.");
    if (!Number.isFinite(delta) || delta === 0 || item.quantity + delta < 0)
      throw new Error("Enter a stock change within the available balance.");
    const saved = this.demo
      ? { ...item, quantity: +(item.quantity + delta).toFixed(2) }
      : await repository.adjustStock(id, delta);
    this.requireWorkspace(generation);
    this.supplies = this.supplies.map((item) =>
      item.id === id ? saved : item,
    );
  }
  createBirdId() {
    return makeId("B");
  }
  createEmptyBird(): Bird {
    return {
      id: this.createBirdId(),
      name: "",
      breed: "Unknown",
      flockId: "",
      bloodline: "",
      sex: "Male",
      color: "",
      hatchDate: today(),
      weight: 0,
      status: "Active",
      penId: "",
      sireId: "",
      damId: "",
      breedingId: "",
      breeder: "",
      pedigreeNotes: "",
    };
  }
}
export const store = new FarmStore();
