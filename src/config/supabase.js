import dotenv from "dotenv";

dotenv.config();

export const SUPABASE_URL = String(process.env.SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const SUPABASE_SECRET_KEY = String(
  process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "",
).trim();

export const PUBLIC_BUCKET =
  String(process.env.SUPABASE_PUBLIC_BUCKET || "ewucsc-public").trim() ||
  "ewucsc-public";

export const PRIVATE_BUCKET =
  String(process.env.SUPABASE_PRIVATE_BUCKET || "ewucsc-private").trim() ||
  "ewucsc-private";

const required = () => {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is missing");
  }

  if (!SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing",
    );
  }
};

const authHeaders = (extra = {}) => {
  required();

  return {
    apikey: SUPABASE_SECRET_KEY,
    ...(!SUPABASE_SECRET_KEY.startsWith("sb_secret_")
      ? { Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }
      : {}),
    ...extra,
  };
};

const readError = async (response) => {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text);
    const error = new Error(
      parsed.message || parsed.error_description || parsed.error || text,
    );
    error.code = parsed.code;
    error.details = parsed.details;
    error.hint = parsed.hint;
    error.status = response.status;
    return error;
  } catch {
    const error = new Error(
      text || `Supabase request failed (${response.status})`,
    );
    error.status = response.status;
    return error;
  }
};

export const supabaseRest = async (
  path,
  { method = "GET", body, headers = {} } = {},
) => {
  required();

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: authHeaders({
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const storagePath = (value) =>
  String(value)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

let bucketsReadyPromise;

export const ensureStorageBuckets = async () => {
  if (!bucketsReadyPromise) {
    bucketsReadyPromise = (async () => {
      const buckets = [
        { id: PUBLIC_BUCKET, name: PUBLIC_BUCKET, public: true },
        { id: PRIVATE_BUCKET, name: PRIVATE_BUCKET, public: false },
      ];

      for (const bucket of buckets) {
        const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            ...bucket,
            file_size_limit: 10 * 1024 * 1024,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          if (
            response.status !== 409 &&
            !/already exists|duplicate/i.test(text)
          ) {
            const error = new Error(
              text || `Failed to create storage bucket ${bucket.id}`,
            );
            error.status = response.status;
            throw error;
          }
        }
      }
    })().catch((error) => {
      bucketsReadyPromise = null;
      throw error;
    });
  }

  await bucketsReadyPromise;
};

export const uploadStorageObject = async ({
  bucket,
  path,
  buffer,
  contentType = "application/octet-stream",
  upsert = false,
}) => {
  await ensureStorageBuckets();

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath(path)}`,
    {
      method: "POST",
      headers: authHeaders({
        "Content-Type": contentType,
        "x-upsert": upsert ? "true" : "false",
      }),
      body: buffer,
    },
  );

  if (!response.ok) throw await readError(response);

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const downloadStorageObject = async ({ bucket, path }) => {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${storagePath(path)}`,
    {
      headers: authHeaders(),
    },
  );

  if (!response.ok) throw await readError(response);

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType:
      response.headers.get("content-type") || "application/octet-stream",
  };
};

export const removeStorageObject = async ({ bucket, path }) => {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: "DELETE",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [path] }),
    },
  );

  if (!response.ok) throw await readError(response);

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const upsertDocument = async ({ id, collection, data }) => {
  return supabaseRest("/rest/v1/documents?on_conflict=collection,id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: [{ id, collection, data }],
  });
};

export const pingSupabase = async () => {
  await supabaseRest("/rest/v1/documents?select=id&limit=1");
  return true;
};
