import { ObjectId } from "mongodb";
import dotenv from "dotenv";
import { pingSupabase, supabaseRest } from "./supabase.js";

dotenv.config();

const PAGE_SIZE = 1000;

const objectIdString = (value) => {
  if (!value) return null;

  if (typeof value === "string" && ObjectId.isValid(value)) {
    return value.toLowerCase();
  }

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString().toLowerCase();
    }

    if (value._bsontype === "ObjectId" && typeof value.toString === "function") {
      return value.toString().toLowerCase();
    }
  }

  return null;
};

const normalizeForStorage = (value) => {
  if (value instanceof Date) return value.toISOString();

  const oid = objectIdString(value);
  if (oid) return oid;

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStorage(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, normalizeForStorage(item)]),
    );
  }

  return value;
};

const valueAt = (object, path) =>
  String(path)
    .split(".")
    .reduce((current, key) => current?.[key], object);

const comparable = (value) => {
  const oid = objectIdString(value);
  if (oid) return oid;

  if (value instanceof Date) return value.getTime();

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  ) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return value;
};

const sameValue = (left, right) => {
  const a = comparable(left);
  const b = comparable(right);

  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    return (
      JSON.stringify(normalizeForStorage(a)) ===
      JSON.stringify(normalizeForStorage(b))
    );
  }

  return a === b;
};

const matchesCondition = (actual, condition) => {
  if (
    condition &&
    typeof condition === "object" &&
    !Array.isArray(condition) &&
    !objectIdString(condition) &&
    !(condition instanceof Date)
  ) {
    const operators = Object.keys(condition).filter((key) => key.startsWith("$"));

    if (operators.length > 0) {
      for (const operator of operators) {
        const expected = condition[operator];

        if (operator === "$ne" && sameValue(actual, expected)) return false;

        if (operator === "$in") {
          const values = Array.isArray(expected) ? expected : [];
          const matched = Array.isArray(actual)
            ? actual.some((item) =>
                values.some((value) => sameValue(item, value)),
              )
            : values.some((value) => sameValue(actual, value));
          if (!matched) return false;
        }

        if (operator === "$exists") {
          const exists = actual !== undefined;
          if (exists !== Boolean(expected)) return false;
        }

        if (["$gte", "$lte", "$gt", "$lt"].includes(operator)) {
          const a = comparable(actual);
          const b = comparable(expected);

          if (operator === "$gte" && !(a >= b)) return false;
          if (operator === "$lte" && !(a <= b)) return false;
          if (operator === "$gt" && !(a > b)) return false;
          if (operator === "$lt" && !(a < b)) return false;
        }
      }

      return true;
    }
  }

  return sameValue(actual, condition);
};

const matchesQuery = (document, query = {}) => {
  for (const [key, condition] of Object.entries(query || {})) {
    if (key === "$or") {
      if (
        !Array.isArray(condition) ||
        !condition.some((clause) => matchesQuery(document, clause))
      ) {
        return false;
      }
      continue;
    }

    if (key === "$and") {
      if (
        !Array.isArray(condition) ||
        !condition.every((clause) => matchesQuery(document, clause))
      ) {
        return false;
      }
      continue;
    }

    if (!matchesCondition(valueAt(document, key), condition)) return false;
  }

  return true;
};

const setAt = (target, path, value) => {
  const keys = String(path).split(".");
  let current = target;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }

  current[keys.at(-1)] = value;
};

const unsetAt = (target, path) => {
  const keys = String(path).split(".");
  let current = target;

  for (let index = 0; index < keys.length - 1; index += 1) {
    current = current?.[keys[index]];
    if (!current || typeof current !== "object") return;
  }

  delete current[keys.at(-1)];
};

const clone = (value) => {
  if (value === undefined) return undefined;
  return structuredClone(normalizeForStorage(value));
};

const applyUpdate = (document, update = {}, { inserting = false } = {}) => {
  const next = { ...document };

  if (!Object.keys(update).some((key) => key.startsWith("$"))) {
    const id = next._id;
    return { _id: id, ...clone(update) };
  }

  if (inserting && update.$setOnInsert) {
    for (const [path, value] of Object.entries(update.$setOnInsert)) {
      setAt(next, path, clone(value));
    }
  }

  if (update.$set) {
    for (const [path, value] of Object.entries(update.$set)) {
      setAt(next, path, clone(value));
    }
  }

  if (update.$inc) {
    for (const [path, value] of Object.entries(update.$inc)) {
      const current = Number(valueAt(next, path) || 0);
      setAt(next, path, current + Number(value || 0));
    }
  }

  if (update.$unset) {
    for (const path of Object.keys(update.$unset)) unsetAt(next, path);
  }

  return next;
};

const seedFromFilter = (filter = {}) => {
  const result = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith("$")) continue;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !objectIdString(value) &&
      !(value instanceof Date) &&
      Object.keys(value).some((operator) => operator.startsWith("$"))
    ) {
      continue;
    }

    setAt(result, key, clone(value));
  }

  return result;
};

const projectDocument = (document, projection) => {
  if (!projection) return document;

  const included = Object.entries(projection)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);

  if (included.length === 0) return document;

  const result = {};

  if (projection._id !== 0 && document._id !== undefined) {
    result._id = document._id;
  }

  for (const key of included) {
    if (key === "_id") continue;
    const value = valueAt(document, key);
    if (value !== undefined) setAt(result, key, value);
  }

  return result;
};

const sortDocuments = (rows, specification = {}) => {
  const fields = Object.entries(specification || {});
  if (fields.length === 0) return rows;

  return [...rows].sort((left, right) => {
    for (const [field, direction] of fields) {
      const a = comparable(valueAt(left, field));
      const b = comparable(valueAt(right, field));

      if (sameValue(a, b)) continue;
      if (a === undefined || a === null) return direction >= 0 ? -1 : 1;
      if (b === undefined || b === null) return direction >= 0 ? 1 : -1;

      return (a < b ? -1 : 1) * (Number(direction) >= 0 ? 1 : -1);
    }

    return 0;
  });
};

const expressionValue = (document, expression) => {
  if (typeof expression === "string" && expression.startsWith("$")) {
    return valueAt(document, expression.slice(1));
  }

  if (
    expression &&
    typeof expression === "object" &&
    Array.isArray(expression.$ifNull)
  ) {
    const [candidate, fallback] = expression.$ifNull;
    const value = expressionValue(document, candidate);
    return value === null || value === undefined ? fallback : value;
  }

  return expression;
};

const runAggregation = (rows, pipeline = []) => {
  let current = [...rows];

  for (const stage of pipeline) {
    if (stage.$group) {
      const groups = new Map();
      const { _id: groupExpression, ...accumulators } = stage.$group;

      for (const row of current) {
        const groupValue = expressionValue(row, groupExpression);
        const groupKey = JSON.stringify(normalizeForStorage(groupValue));

        if (!groups.has(groupKey)) groups.set(groupKey, { _id: groupValue });

        const target = groups.get(groupKey);

        for (const [name, accumulator] of Object.entries(accumulators)) {
          if (Object.hasOwn(accumulator, "$sum")) {
            const operand = accumulator.$sum;
            const increment =
              typeof operand === "number"
                ? operand
                : Number(expressionValue(row, operand) || 0);
            target[name] = Number(target[name] || 0) + increment;
          }

          if (Object.hasOwn(accumulator, "$max")) {
            const candidate = expressionValue(row, accumulator.$max);
            if (
              target[name] === undefined ||
              comparable(candidate) > comparable(target[name])
            ) {
              target[name] = candidate;
            }
          }
        }
      }

      current = [...groups.values()];
      continue;
    }

    if (stage.$sort) current = sortDocuments(current, stage.$sort);
  }

  return current;
};

const normalizeSupabaseError = (error) => {
  if (error?.code === "23505" || error?.status === 409) {
    const duplicate = new Error(error.message || "Duplicate key");
    duplicate.code = 11000;
    return duplicate;
  }

  return error;
};

class Cursor {
  constructor(collection, query = {}) {
    this.collection = collection;
    this.query = query;
    this.sortSpecification = null;
    this.limitValue = null;
    this.projection = null;
  }

  sort(specification) {
    this.sortSpecification = specification;
    return this;
  }

  limit(value) {
    this.limitValue = Math.max(0, Number(value || 0));
    return this;
  }

  project(projection) {
    this.projection = projection;
    return this;
  }

  async toArray() {
    let rows = (await this.collection._all()).filter((row) =>
      matchesQuery(row, this.query),
    );

    if (this.sortSpecification) rows = sortDocuments(rows, this.sortSpecification);
    if (this.limitValue !== null) rows = rows.slice(0, this.limitValue);
    if (this.projection) {
      rows = rows.map((row) => projectDocument(row, this.projection));
    }

    return rows;
  }
}

class AggregateCursor {
  constructor(collection, pipeline) {
    this.collection = collection;
    this.pipeline = pipeline;
  }

  async toArray() {
    return runAggregation(await this.collection._all(), this.pipeline);
  }
}

class SupabaseCollection {
  constructor(name) {
    this.name = name;
  }

  async _all() {
    const rows = [];
    let offset = 0;

    while (true) {
      const page = await supabaseRest(
        `/rest/v1/documents?select=id,data&collection=eq.${encodeURIComponent(
          this.name,
        )}&limit=${PAGE_SIZE}&offset=${offset}`,
      );

      const batch = Array.isArray(page) ? page : [];

      rows.push(
        ...batch.map((row) => ({
          ...(row.data || {}),
          _id: ObjectId.isValid(row.id) ? new ObjectId(row.id) : row.id,
        })),
      );

      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return rows;
  }

  async _write(document) {
    const id = objectIdString(document._id) || new ObjectId().toHexString();

    const data = normalizeForStorage(
      Object.fromEntries(
        Object.entries(document).filter(([key]) => key !== "_id"),
      ),
    );

    try {
      await supabaseRest("/rest/v1/documents?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{ id, collection: this.name, data }],
      });
    } catch (error) {
      throw normalizeSupabaseError(error);
    }

    return ObjectId.isValid(id) ? new ObjectId(id) : id;
  }

  async _patchById(id, document) {
    const normalizedId = objectIdString(id) || String(id);
    const data = normalizeForStorage(
      Object.fromEntries(
        Object.entries(document).filter(([key]) => key !== "_id"),
      ),
    );

    try {
      await supabaseRest(
        `/rest/v1/documents?id=eq.${encodeURIComponent(
          normalizedId,
        )}&collection=eq.${encodeURIComponent(this.name)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: { data, updated_at: new Date().toISOString() },
        },
      );
    } catch (error) {
      throw normalizeSupabaseError(error);
    }
  }

  find(query = {}) {
    return new Cursor(this, query);
  }

  async findOne(query = {}) {
    const rows = await this.find(query).limit(1).toArray();
    return rows[0] || null;
  }

  async insertOne(document) {
    const id = await this._write(document);
    return { acknowledged: true, insertedId: id };
  }

  async updateOne(filter, update, options = {}) {
    const existing = await this.findOne(filter);

    if (!existing) {
      if (!options.upsert) {
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
          upsertedId: null,
        };
      }

      const seeded = seedFromFilter(filter);
      const inserted = applyUpdate(seeded, update, { inserting: true });
      const result = await this.insertOne(inserted);

      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
        upsertedId: result.insertedId,
      };
    }

    const changed = applyUpdate(existing, update);
    await this._patchById(existing._id, changed);

    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null,
    };
  }

  async updateMany(filter, update, options = {}) {
    const matches = await this.find(filter).toArray();

    if (matches.length === 0 && options.upsert) {
      return this.updateOne(filter, update, { upsert: true });
    }

    await Promise.all(
      matches.map(async (document) => {
        const changed = applyUpdate(document, update);
        await this._patchById(document._id, changed);
      }),
    );

    return {
      acknowledged: true,
      matchedCount: matches.length,
      modifiedCount: matches.length,
      upsertedCount: 0,
      upsertedId: null,
    };
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const existing = await this.findOne(filter);

    if (!existing) {
      if (!options.upsert) return null;

      const seeded = seedFromFilter(filter);
      const inserted = applyUpdate(seeded, update, { inserting: true });
      const result = await this.insertOne(inserted);
      return { ...inserted, _id: result.insertedId };
    }

    const changed = applyUpdate(existing, update);
    await this._patchById(existing._id, changed);
    return changed;
  }

  async deleteOne(filter) {
    const existing = await this.findOne(filter);

    if (!existing) return { acknowledged: true, deletedCount: 0 };

    const id = objectIdString(existing._id) || String(existing._id);

    await supabaseRest(
      `/rest/v1/documents?id=eq.${encodeURIComponent(
        id,
      )}&collection=eq.${encodeURIComponent(this.name)}`,
      { method: "DELETE" },
    );

    return { acknowledged: true, deletedCount: 1 };
  }

  async countDocuments(query = {}) {
    return (await this.find(query).toArray()).length;
  }

  async distinct(field, query = {}) {
    const rows = await this.find(query).toArray();
    const values = [];
    const seen = new Set();

    for (const row of rows) {
      const value = valueAt(row, field);
      const key = JSON.stringify(normalizeForStorage(value));

      if (!seen.has(key)) {
        seen.add(key);
        values.push(value);
      }
    }

    return values;
  }

  aggregate(pipeline = []) {
    return new AggregateCursor(this, pipeline);
  }

  async createIndex() {
    return `${this.name}_supabase_index`;
  }
}

class SupabaseDatabase {
  collection(name) {
    return new SupabaseCollection(name);
  }
}

let connectionPromise;

export const connectDB = async () => {
  if (!connectionPromise) {
    connectionPromise = pingSupabase()
      .then(() => {
        console.log("✅ Supabase connected for EWUCSC");
        return new SupabaseDatabase();
      })
      .catch((error) => {
        connectionPromise = null;
        console.error("❌ Supabase connection error:", error);
        throw error;
      });
  }

  return connectionPromise;
};
