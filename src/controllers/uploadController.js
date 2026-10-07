import { ObjectId } from "mongodb";
import { connectDB } from "../config/db.js";
import {
  downloadStorageObject,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  removeStorageObject,
  uploadStorageObject,
} from "../config/supabase.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PUBLIC_SCOPES = new Set(["content", "gallery", "partner"]);
const PRIVATE_SCOPES = new Set(["challenge", "homework"]);
const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "pdf",
  "txt",
  "md",
  "json",
  "csv",
  "zip",
  "7z",
  "rar",
  "pcap",
  "pcapng",
]);

const safeFileName = (value = "upload") =>
  String(value)
    .replace(/[\\/\0]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "upload";

const fileExtension = (name = "") => {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
};

const isAllowedUpload = (name, mimeType) => {
  if (
    mimeType === "text/html" ||
    mimeType === "image/svg+xml" ||
    /javascript/i.test(mimeType)
  ) {
    return false;
  }

  if (String(mimeType).startsWith("image/")) return true;
  return ALLOWED_EXTENSIONS.has(fileExtension(name));
};

const getAssetCollection = async () => {
  const db = await connectDB();
  return db.collection("mediaAssets");
};

export const uploadAsset = async (req, res) => {
  try {
    const scope = String(req.params.scope || "").toLowerCase();
    const isPublic = PUBLIC_SCOPES.has(scope);

    if (!isPublic && !PRIVATE_SCOPES.has(scope)) {
      return res.status(400).send({ message: "Unsupported upload scope" });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).send({ message: "Choose a file to upload" });
    }

    if (req.body.length > MAX_UPLOAD_BYTES) {
      return res.status(413).send({ message: "File must be 10 MB or smaller" });
    }

    let originalName = req.get("x-file-name") || "upload";
    try {
      originalName = decodeURIComponent(originalName);
    } catch {
      // Keep the original header when it was not URI-encoded.
    }

    originalName = safeFileName(originalName);
    const mimeType = String(
      req.get("x-file-type") || "application/octet-stream",
    )
      .trim()
      .slice(0, 120);

    if (!isAllowedUpload(originalName, mimeType)) {
      return res.status(400).send({
        message:
          "Unsupported file type. Use common images, PDF, text, JSON, CSV, ZIP/7z/RAR or PCAP files.",
      });
    }

    const visibility = isPublic ? "public" : "private";
    const bucket = isPublic ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    const id = new ObjectId();
    const idString = id.toHexString();
    const objectPath = `${scope}/${idString}/${originalName}`;

    await uploadStorageObject({
      bucket,
      path: objectPath,
      buffer: req.body,
      contentType: mimeType,
    });

    const now = new Date();
    const assetDoc = {
      _id: id,
      originalName,
      mimeType,
      size: req.body.length,
      scope,
      visibility,
      bucket,
      objectPath,
      uploadedBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const assets = await getAssetCollection();
      await assets.insertOne(assetDoc);
    } catch (error) {
      await removeStorageObject({ bucket, path: objectPath }).catch(() => {});
      throw error;
    }

    const apiPath = `/uploads/${visibility}/${idString}`;
    const publicUrl = isPublic ? `/api/uploads/public/${idString}` : null;

    return res.status(201).send({
      message: "Upload complete",
      asset: {
        id: idString,
        name: originalName,
        mimeType,
        size: req.body.length,
        scope,
        visibility,
        apiPath,
        url: publicUrl,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).send({ message: "Failed to upload file" });
  }
};

const streamAsset = async (req, res, expectedVisibility) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send({ message: "Invalid asset ID" });
  }

  const assets = await getAssetCollection();
  const file = await assets.findOne({ _id: new ObjectId(req.params.id) });

  if (!file || file.visibility !== expectedVisibility) {
    return res.status(404).send({ message: "Asset not found" });
  }

  const downloaded = await downloadStorageObject({
    bucket: file.bucket,
    path: file.objectPath,
  });

  res.setHeader(
    "Content-Type",
    file.mimeType || downloaded.contentType || "application/octet-stream",
  );
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(
      file.originalName || "asset",
    )}`,
  );
  res.setHeader(
    "Cache-Control",
    expectedVisibility === "public"
      ? "public, max-age=86400"
      : "private, no-store",
  );

  if (expectedVisibility === "public") {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }

  return res.send(downloaded.buffer);
};

export const getPublicAsset = async (req, res) => {
  try {
    return await streamAsset(req, res, "public");
  } catch (error) {
    console.error("Public asset fetch error:", error);
    return res.status(500).send({ message: "Failed to load asset" });
  }
};

export const getPrivateAsset = async (req, res) => {
  try {
    return await streamAsset(req, res, "private");
  } catch (error) {
    console.error("Private asset fetch error:", error);
    return res.status(500).send({ message: "Failed to load asset" });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid asset ID" });
    }

    const assets = await getAssetCollection();
    const id = new ObjectId(req.params.id);
    const file = await assets.findOne({ _id: id });

    if (!file) return res.status(404).send({ message: "Asset not found" });

    await removeStorageObject({
      bucket: file.bucket,
      path: file.objectPath,
    });

    await assets.deleteOne({ _id: id });

    return res.send({ message: "Asset deleted" });
  } catch (error) {
    console.error("Delete asset error:", error);
    return res.status(500).send({ message: "Failed to delete asset" });
  }
};
