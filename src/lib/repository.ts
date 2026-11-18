import { cloud } from "./supabase";
import type {
  Bird,
  BreedingRecord,
  HealthLog,
  Flock,
  Pen,
  Reminder,
  Supply,
  Versioned,
} from "./types";
export interface FarmData {
  birds: Bird[];
  flocks: Flock[];
  pens: Pen[];
  breeding: BreedingRecord[];
  health: HealthLog[];
  reminders: Reminder[];
  supplies: Supply[];
}
export type Collection = keyof FarmData;
const columns: Record<Collection, string[]> = {
  birds: [
    "id",
    "name",
    "breed",
    "bloodline",
    "flockId",
    "sex",
    "color",
    "hatchDate",
    "weight",
    "status",
    "penId",
    "sireId",
    "damId",
    "breedingId",
    "breeder",
    "pedigreeNotes",
    "photoPath",
  ],
  pens: ["id", "name"],
  flocks: ["id", "name"],
  breeding: [
    "id",
    "sireId",
    "damId",
    "matingDate",
    "eggsCount",
    "hatchedCount",
    "notes",
  ],
  health: ["id", "targetType", "targetId", "category", "date", "notes"],
  reminders: ["id", "birdId", "description", "dueDate", "done"],
  supplies: ["id", "name", "category", "quantity", "unit", "reorderLevel"],
};
const nullable = new Set([
  "flockId",
  "penId",
  "sireId",
  "damId",
  "breedingId",
  "photoPath",
]);
export function payload(kind: Collection, value: object) {
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    columns[kind]
      .filter((key) => source[key] !== undefined)
      .map((key) => [
        key,
        nullable.has(key) && !source[key] ? null : source[key],
      ]),
  );
}
export async function loadFarm() {
  const client = cloud();
  const { data: farms, error } = await client
    .from("app_farms")
    .select("id,name")
    .single();
  if (error) throw error;
  const kinds = Object.keys(columns) as Collection[];
  const results = await Promise.all(
    kinds.map(async (kind) => {
      // Explicit paging avoids Supabase's default 1,000-row cap silently truncating reports.
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await client
          .from("app_" + kind)
          .select("*")
          .order("id")
          .range(offset, offset + 999);
        if (result.error) throw result.error;
        rows.push(...result.data);
        if (result.data.length < 1000) break;
      }
      return [kind, rows] as const;
    }),
  );
  return {
    farm: farms,
    records: Object.fromEntries(results) as unknown as FarmData,
  };
}
export async function save<T extends { id: string } & Versioned>(
  kind: Collection,
  record: T,
  exists = false,
): Promise<T> {
  const client = cloud(),
    values = payload(kind, record);
  const query = exists
    ? client
        .from("app_" + kind)
        .update(values)
        .eq("id", record.id)
        .eq("version", record.version ?? 1)
    : client.from("app_" + kind).insert(values);
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      "This record changed on another device. Refresh records and try again.",
    );
  return data as T;
}
export async function remove(kind: Collection, id: string, version = 1) {
  const { data, error } = await cloud()
    .from("app_" + kind)
    .delete()
    .eq("id", id)
    .eq("version", version)
    .select("id");
  if (error) throw error;
  if (!data?.length)
    throw new Error(
      "This record changed on another device. Refresh records and try again.",
    );
}
export async function adjustStock(id: string, delta: number): Promise<Supply> {
  const { data, error } = await cloud().rpc("app_adjust_supply", {
    p_id: id,
    p_delta: delta,
  });
  if (error) throw error;
  return data as Supply;
}
export async function logCare(
  record: HealthLog,
  supplyId?: string,
  quantity = 0,
): Promise<HealthLog> {
  const { data, error } = await cloud().rpc("app_log_care", {
    p_record: payload("health", record),
    p_supply_id: supplyId || null,
    p_quantity: quantity,
  });
  if (error) throw error;
  return data as HealthLog;
}
export async function uploadPhoto(
  farmId: string,
  birdId: string,
  file: File,
): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    throw new Error("Choose a JPG, PNG, or WebP photo up to 5 MB.");
  }
  const extension =
    file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${farmId}/${birdId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await cloud()
    .storage.from("farm-bird-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
export async function downloadPhoto(path: string) {
  const { data, error } = await cloud()
    .storage.from("farm-bird-photos")
    .download(path);
  if (error) throw error;
  return URL.createObjectURL(data);
}
export async function removePhoto(path: string) {
  const { error } = await cloud()
    .storage.from("farm-bird-photos")
    .remove([path]);
  if (error) throw error;
}
