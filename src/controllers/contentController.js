import { ObjectId } from "mongodb";
import { getContentCollection } from "../models/contentModel.js";

const TYPES = new Set(["announcements", "blogs"]);

const slugify = (value = "") =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

const serialize = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
};

const validateType = (req, res) => {
  const type = req.params.type;
  if (!TYPES.has(type)) {
    res.status(404).send({ message: "Content type not found" });
    return null;
  }
  return type;
};

export const listPublishedContent = async (req, res) => {
  try {
    const type = validateType(req, res);
    if (!type) return;

    const collection = await getContentCollection(type);
    const rows = await collection
      .find({ published: true, archived: { $ne: true } })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(100)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("Public content list error:", error);
    return res.status(500).send({ message: "Failed to load content" });
  }
};

export const listAllContent = async (req, res) => {
  try {
    const type = validateType(req, res);
    if (!type) return;

    const collection = await getContentCollection(type);
    const rows = await collection
      .find({ archived: { $ne: true } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(300)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("Admin content list error:", error);
    return res.status(500).send({ message: "Failed to load content" });
  }
};

export const createContent = async (req, res) => {
  try {
    const type = validateType(req, res);
    if (!type) return;

    const { title, excerpt = "", body = "", published = false } = req.body;

    if (!title?.trim()) {
      return res.status(400).send({ message: "Title is required" });
    }

    if (type === "blogs" && !body?.trim()) {
      return res.status(400).send({ message: "Blog body is required" });
    }

    const collection = await getContentCollection(type);
    const baseSlug = slugify(title) || "post";
    let slug = baseSlug;
    let counter = 2;

    while (await collection.findOne({ slug })) {
      slug = baseSlug + "-" + counter;
      counter += 1;
    }

    const now = new Date();
    const doc = {
      slug,
      title: title.trim().slice(0, 180),
      excerpt: String(excerpt || "").trim().slice(0, 600),
      body: String(body || "").trim().slice(0, 30000),
      published: Boolean(published),
      archived: false,
      publishedAt: published ? now : null,
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(doc);

    return res.status(201).send({
      message: type === "blogs" ? "Blog created" : "Announcement created",
      item: serialize({ ...doc, _id: result.insertedId }),
    });
  } catch (error) {
    console.error("Create content error:", error);
    return res.status(500).send({ message: "Failed to create content" });
  }
};

export const updateContent = async (req, res) => {
  try {
    const type = validateType(req, res);
    if (!type) return;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid content ID" });
    }

    const collection = await getContentCollection(type);
    const existing = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!existing) {
      return res.status(404).send({ message: "Content not found" });
    }

    const update = { updatedAt: new Date(), updatedBy: req.user.uid };

    for (const field of ["title", "excerpt", "body", "archived"]) {
      if (Object.hasOwn(req.body, field)) update[field] = req.body[field];
    }

    if (Object.hasOwn(req.body, "published")) {
      update.published = Boolean(req.body.published);
      if (update.published && !existing.publishedAt) {
        update.publishedAt = new Date();
      }
    }

    if (update.title) update.title = String(update.title).trim().slice(0, 180);
    if (Object.hasOwn(update, "excerpt")) update.excerpt = String(update.excerpt || "").trim().slice(0, 600);
    if (Object.hasOwn(update, "body")) update.body = String(update.body || "").trim().slice(0, 30000);

    await collection.updateOne({ _id: existing._id }, { $set: update });
    const changed = await collection.findOne({ _id: existing._id });

    return res.send({ message: "Content updated", item: serialize(changed) });
  } catch (error) {
    console.error("Update content error:", error);
    return res.status(500).send({ message: "Failed to update content" });
  }
};


export const getPublishedContentBySlug = async (req, res) => {
  try {
    const type = validateType(req, res);
    if (!type) return;

    const collection = await getContentCollection(type);
    const item = await collection.findOne({
      slug: req.params.slug,
      published: true,
      archived: { $ne: true },
    });

    if (!item) {
      return res.status(404).send({ message: "Content not found" });
    }

    return res.send({ item: serialize(item) });
  } catch (error) {
    console.error("Public content detail error:", error);
    return res.status(500).send({ message: "Failed to load content" });
  }
};
