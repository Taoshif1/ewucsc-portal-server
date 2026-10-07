import dotenv from "dotenv";
import { GridFSBucket, MongoClient, ObjectId } from "mongodb";
import {
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  ensureStorageBuckets,
  uploadStorageObject,
  upsertDocument,
  supabaseRest,
} from "../src/config/supabase.js";

dotenv.config();

const MONGO_URI = String(process.env.MONGO_URI || "").trim();

if (!MONGO_URI) {
  throw new Error("MONGO_URI is required to migrate existing MongoDB data");
}

const COLLECTIONS = [
  "ewucscusers",
  "ctfChallenges",
  "ctfSolves",
  "homeworks",
  "homeworkSubmissions",
  "announcements",
  "blogs",
  "contactMessages",
  "formDefinitions",
  "formSubmissions",
  "gallery",
  "partners",
  "siteSettings",
  "vpResources",
];

const normalize = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map((item) => normalize(item));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }

  return value;
};

const safeFileName = (value = "asset") =>
  String(value)
    .replace(/[\\/\0]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "asset";

const collectStream = async (stream) => {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const normalizeEmail = (value = "") =>
  String(value || "").trim().toLowerCase();

const cleanBootstrapPlaceholders = async (sourceUsers) => {
  const targetRows = await supabaseRest(
    "/rest/v1/documents?select=id,data&collection=eq.ewucscusers&limit=1000",
  );

  const sourceEmails = new Set(
    sourceUsers.map((row) => normalizeEmail(row.email)).filter(Boolean),
  );
  const sourceStudentIds = new Set(
    sourceUsers
      .map((row) => String(row.studentId || "").trim())
      .filter(Boolean),
  );

  const placeholders = (Array.isArray(targetRows) ? targetRows : []).filter(
    (row) => {
      const data = row.data || {};
      const email = normalizeEmail(data.email);
      const studentId = String(data.studentId || "").trim();

      const isGeneratedBootstrapPlaceholder =
        data.approvedBy === "bootstrap-config" &&
        !data.uid;

      const matchesSourceIdentity =
        (email && sourceEmails.has(email)) ||
        (studentId && sourceStudentIds.has(studentId));

      return isGeneratedBootstrapPlaceholder && matchesSourceIdentity;
    },
  );

  for (const row of placeholders) {
    await supabaseRest(
      `/rest/v1/documents?collection=eq.ewucscusers&id=eq.${encodeURIComponent(
        row.id,
      )}`,
      { method: "DELETE" },
    );

    console.log(
      `ewucscusers: removed generated bootstrap placeholder ${row.id} before migration`,
    );
  }
};

const migrateCollection = async (db, name) => {
  const rows = await db.collection(name).find({}).toArray();
  let migrated = 0;

  for (const row of rows) {
    const id = row._id.toString();
    const { _id, ...data } = row;

    await upsertDocument({
      id,
      collection: name,
      data: normalize(data),
    });

    migrated += 1;

    if (migrated % 100 === 0) {
      console.log(`${name}: migrated ${migrated}/${rows.length}`);
    }
  }

  console.log(`${name}: done (${migrated})`);
};

const migrateGridFs = async (db) => {
  const files = await db.collection("media.files").find({}).toArray();

  if (files.length === 0) {
    console.log("media.files: nothing to migrate");
    return;
  }

  await ensureStorageBuckets();

  const bucket = new GridFSBucket(db, { bucketName: "media" });
  let migrated = 0;

  for (const file of files) {
    const id = file._id.toString();
    const metadata = file.metadata || {};
    const visibility =
      metadata.visibility === "private" ? "private" : "public";
    const targetBucket =
      visibility === "private" ? PRIVATE_BUCKET : PUBLIC_BUCKET;
    const scope = String(metadata.scope || "legacy").trim() || "legacy";
    const originalName = safeFileName(
      metadata.originalName || file.filename || "asset",
    );
    const objectPath = `${scope}/${id}/${originalName}`;
    const mimeType =
      file.contentType ||
      metadata.mimeType ||
      "application/octet-stream";

    const buffer = await collectStream(bucket.openDownloadStream(file._id));

    await uploadStorageObject({
      bucket: targetBucket,
      path: objectPath,
      buffer,
      contentType: mimeType,
      upsert: true,
    });

    await upsertDocument({
      id,
      collection: "mediaAssets",
      data: {
        originalName,
        mimeType,
        size: Number(file.length || buffer.length || 0),
        scope,
        visibility,
        bucket: targetBucket,
        objectPath,
        uploadedBy: metadata.uploadedBy || null,
        createdAt: normalize(
          metadata.createdAt || file.uploadDate || new Date(),
        ),
        updatedAt: normalize(new Date()),
      },
    });

    migrated += 1;
    console.log(`media.files: migrated ${migrated}/${files.length}`);
  }
};

const main = async () => {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();

    const db = client.db("ewucsc");

    console.log("Migrating collections...");

    const sourceUsers = await db.collection("ewucscusers").find({}).toArray();
    await cleanBootstrapPlaceholders(sourceUsers);

    for (const name of COLLECTIONS) {
      await migrateCollection(db, name);
    }

    console.log("Migrating GridFS media...");
    await migrateGridFs(db);

    console.log("Migration completed successfully.");
  } finally {
    await client.close();
  }
};

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
