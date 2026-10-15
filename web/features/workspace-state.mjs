import { createStorage } from "../adapters/storage.mjs";

const recordVersion = 1;
const fields = ["lessonId", "contentRevision", "exerciseId", "fileId"];

function identityKey(identity) {
  if (!fields.every(name => typeof identity?.[name] === "string" && identity[name])) {
    throw new TypeError("A complete draft identity is required");
  }
  return JSON.stringify(fields.map(name => identity[name]));
}

// Records stay in memory after a failed save so changing steps does not discard work.
// A corrupt record is never overwritten by autosave; reset is an explicit UI action.
export function createWorkspaceState(storage, namespace) {
  const drafts = storage ? createStorage(storage, `${namespace}:drafts:v1`) : null;
  const records = new Map();
  const load = (identity, initialValue = "") => {
    const key = identityKey(identity);
    if (records.has(key)) return records.get(key);
    const record = { identity: { ...identity }, value: initialValue, initialValue, dirty: false, blocked: false, status: "initial" };
    records.set(key, record);
    if (!drafts) {
      record.status = "unavailable";
      return record;
    }
    try {
      const raw = drafts.readDraft(identity);
      if (raw === null) return record;
      let saved;
      try { saved = JSON.parse(raw); } catch { /* Keep the original stored text. */ }
      if (!saved || saved.version !== recordVersion || typeof saved.value !== "string" || saved.value.length > 200000) {
        record.status = "corrupt";
        record.blocked = true;
      } else {
        record.value = saved.value;
        record.status = "saved";
      }
    } catch {
      record.status = "read-error";
      record.blocked = true;
    }
    return record;
  };
  const update = (identity, value) => {
    if (typeof value !== "string" || value.length > 200000) throw new TypeError("Draft text must be at most 200000 characters");
    const record = records.get(identityKey(identity));
    if (!record) throw new Error("Load a field before editing it");
    record.value = value;
    record.dirty = true;
    if (!record.blocked) record.status = "pending";
    return record;
  };
  const save = identity => {
    const record = records.get(identityKey(identity));
    if (!record) throw new Error("Load a field before saving it");
    if (record.blocked || !record.dirty) return record;
    if (!drafts) { record.status = "unavailable"; return record; }
    try {
      drafts.writeDraft(record.identity, JSON.stringify({ version: recordVersion, value: record.value }));
      record.dirty = false;
      record.status = "saved";
    } catch {
      record.status = "write-error";
    }
    return record;
  };
  const reset = identity => {
    const record = records.get(identityKey(identity));
    if (!record) throw new Error("Load a field before resetting it");
    if (drafts) {
      try { drafts.removeDraft(record.identity); } catch { return { ok: false, record }; }
    } else {
      return { ok: false, record };
    }
    record.value = record.initialValue;
    record.dirty = false;
    record.blocked = false;
    record.status = "initial";
    return { ok: true, record };
  };
  return Object.freeze({ load, update, save, reset, records: () => [...records.values()] });
}

export function readPreferences(storage, namespace) {
  const defaults = { theme: "dark", effects: true };
  if (!storage) return { value: defaults, status: "unavailable" };
  try {
    const raw = storage.getItem(`${namespace}:preferences:v1`);
    if (raw === null) return { value: defaults, status: "initial" };
    let saved;
    try { saved = JSON.parse(raw); } catch { /* Defaults do not erase the record. */ }
    if (!saved || saved.version !== 1 || !["light", "dark"].includes(saved.theme) || typeof saved.effects !== "boolean") {
      return { value: defaults, status: "corrupt" };
    }
    return { value: { theme: saved.theme, effects: saved.effects }, status: "saved" };
  } catch { return { value: defaults, status: "unavailable" }; }
}

export function writePreferences(storage, namespace, preferences) {
  if (!storage) return false;
  try {
    storage.setItem(`${namespace}:preferences:v1`, JSON.stringify({ version: 1, theme: preferences.theme, effects: preferences.effects }));
    return true;
  } catch { return false; }
}
