import { getSiteSettingsCollection } from "../models/siteSettingsModel.js";

const SETTINGS_KEY = "public-site";

const DEFAULT_SETTINGS = {
  clubEmail: "ewcsc@ewubd.edu",
  technicalEmail: "hello@zabermahmud.me",
  socialLinks: {
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    x: "",
  },
};

const normalizeEmail = (value, fallback = "") => {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return fallback;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const normalizeUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return url.slice(0, 2000);
  } catch {
    return null;
  }
};

const mergeDefaults = (doc = {}) => ({
  clubEmail: doc.clubEmail || DEFAULT_SETTINGS.clubEmail,
  technicalEmail: doc.technicalEmail || DEFAULT_SETTINGS.technicalEmail,
  socialLinks: {
    ...DEFAULT_SETTINGS.socialLinks,
    ...(doc.socialLinks || {}),
  },
  updatedAt: doc.updatedAt || null,
});

export const getSiteSettings = async (req, res) => {
  try {
    const collection = await getSiteSettingsCollection();
    const settings = await collection.findOne({ key: SETTINGS_KEY });
    return res.send({ settings: mergeDefaults(settings) });
  } catch (error) {
    console.error("Site settings read error:", error);
    return res.status(500).send({ message: "Failed to load site settings" });
  }
};

export const updateSiteSettings = async (req, res) => {
  try {
    const clubEmail = normalizeEmail(req.body?.clubEmail, DEFAULT_SETTINGS.clubEmail);
    const technicalEmail = normalizeEmail(
      req.body?.technicalEmail,
      DEFAULT_SETTINGS.technicalEmail,
    );

    if (!clubEmail || !technicalEmail) {
      return res.status(400).send({ message: "Enter valid email addresses" });
    }

    const requestedSocials = req.body?.socialLinks || {};
    const socialLinks = {};

    for (const key of Object.keys(DEFAULT_SETTINGS.socialLinks)) {
      const value = normalizeUrl(requestedSocials[key] || "");
      if (value === null) {
        return res.status(400).send({
          message: `${key} must be a valid http/https URL`,
        });
      }
      socialLinks[key] = value;
    }

    const update = {
      key: SETTINGS_KEY,
      clubEmail,
      technicalEmail,
      socialLinks,
      updatedAt: new Date(),
      updatedBy: req.user.uid,
    };

    const collection = await getSiteSettingsCollection();
    await collection.updateOne(
      { key: SETTINGS_KEY },
      { $set: update },
      { upsert: true },
    );

    return res.send({
      message: "Site settings updated",
      settings: mergeDefaults(update),
    });
  } catch (error) {
    console.error("Site settings update error:", error);
    return res.status(500).send({ message: "Failed to update site settings" });
  }
};
