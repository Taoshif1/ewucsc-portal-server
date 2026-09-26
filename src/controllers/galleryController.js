import { ObjectId } from "mongodb";
import { getGalleryCollection } from "../models/galleryModel.js";
import { normalizePublicMediaUrl } from "../utils/publicMedia.js";

const serialize = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    ...rest,
    imageUrl: normalizePublicMediaUrl(rest.imageUrl, rest.assetId) || "",
    id: _id.toString(),
  };
};

const normalizeDate = (value = "") => {
  const date = String(value || "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T00:00:00Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? null
    : date;
};

const normalizeImageUrl = (value = "", assetId = "") =>
  normalizePublicMediaUrl(value, assetId);

export const listGallery = async (req, res) => {
  try {
    const gallery = await getGalleryCollection();
    const rows = await gallery
      .find({ published: true, archived: { $ne: true } })
      .sort({ eventDate: -1, createdAt: -1 })
      .limit(300)
      .toArray();

    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("Gallery list error:", error);
    return res.status(500).send({ message: "Failed to load gallery" });
  }
};

export const listAllGallery = async (req, res) => {
  try {
    const gallery = await getGalleryCollection();
    const rows = await gallery.find({}).sort({ archived: 1, createdAt: -1 }).limit(500).toArray();
    return res.send({ items: rows.map(serialize) });
  } catch (error) {
    console.error("Gallery admin list error:", error);
    return res.status(500).send({ message: "Failed to load gallery" });
  }
};

export const createGalleryItem = async (req, res) => {
  try {
    const {
      title = "",
      caption = "",
      imageUrl = "",
      assetId = "",
      eventDate = "",
      published = true,
    } = req.body;

    const normalizedImage = normalizeImageUrl(imageUrl, assetId);
    if (!normalizedImage) {
      return res.status(400).send({ message: "Upload a gallery image first" });
    }

    const normalizedDate = normalizeDate(eventDate);
    if (normalizedDate === null) {
      return res.status(400).send({ message: "Invalid event date" });
    }

    const now = new Date();
    const doc = {
      title: String(title || "").trim().slice(0, 160),
      caption: String(caption || "").trim().slice(0, 1000),
      imageUrl: normalizedImage,
      assetId: ObjectId.isValid(assetId) ? assetId : null,
      eventDate: normalizedDate,
      published: Boolean(published),
      archived: false,
      createdBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const gallery = await getGalleryCollection();
    const result = await gallery.insertOne(doc);

    return res.status(201).send({
      message: "Gallery image added",
      item: serialize({ ...doc, _id: result.insertedId }),
    });
  } catch (error) {
    console.error("Create gallery item error:", error);
    return res.status(500).send({ message: "Failed to add gallery image" });
  }
};

export const updateGalleryItem = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid gallery item ID" });
    }

    const gallery = await getGalleryCollection();
    const existing = await gallery.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).send({ message: "Gallery item not found" });

    const update = { updatedAt: new Date(), updatedBy: req.user.uid };

    for (const field of ["title", "caption", "published", "archived"]) {
      if (Object.hasOwn(req.body, field)) update[field] = req.body[field];
    }

    if (Object.hasOwn(req.body, "eventDate")) {
      const normalizedDate = normalizeDate(req.body.eventDate);
      if (normalizedDate === null) {
        return res.status(400).send({ message: "Invalid event date" });
      }
      update.eventDate = normalizedDate;
    }

    if (Object.hasOwn(req.body, "imageUrl")) {
      const normalizedImage = normalizeImageUrl(req.body.imageUrl, req.body.assetId || existing.assetId);
      if (!normalizedImage) {
        return res.status(400).send({ message: "Invalid image URL" });
      }
      update.imageUrl = normalizedImage;
    }

    if (Object.hasOwn(req.body, "assetId")) {
      update.assetId = ObjectId.isValid(req.body.assetId) ? req.body.assetId : null;
    }

    if (Object.hasOwn(update, "title")) update.title = String(update.title || "").trim().slice(0, 160);
    if (Object.hasOwn(update, "caption")) update.caption = String(update.caption || "").trim().slice(0, 1000);
    if (Object.hasOwn(update, "published")) update.published = Boolean(update.published);
    if (Object.hasOwn(update, "archived")) update.archived = Boolean(update.archived);

    await gallery.updateOne({ _id: existing._id }, { $set: update });
    const changed = await gallery.findOne({ _id: existing._id });
    return res.send({ message: "Gallery item updated", item: serialize(changed) });
  } catch (error) {
    console.error("Update gallery item error:", error);
    return res.status(500).send({ message: "Failed to update gallery item" });
  }
};

export const deleteGalleryItem = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid gallery item ID" });
    }

    const gallery = await getGalleryCollection();
    const result = await gallery.deleteOne({ _id: new ObjectId(req.params.id) });

    if (!result.deletedCount) return res.status(404).send({ message: "Gallery item not found" });
    return res.send({ message: "Gallery item deleted" });
  } catch (error) {
    console.error("Delete gallery item error:", error);
    return res.status(500).send({ message: "Failed to delete gallery item" });
  }
};
