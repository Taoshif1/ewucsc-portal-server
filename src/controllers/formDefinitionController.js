import { ObjectId } from "mongodb";
import { getFormDefinitionCollection } from "../models/formDefinitionModel.js";
import { getFormSubmissionCollection } from "../models/formSubmissionModel.js";

const FORM_KEY_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;
const STATUSES = new Set(["draft", "open", "closed", "archived"]);
const TYPES = new Set(["recruitment"]);

export const DEFAULT_RECRUITMENT_SECTIONS = {
  personal: true,
  activities: true,
  specialization: true,
  experience: true,
  clubHistory: true,
  onlinePresence: true,
  tellUsMore: true,
};

export const DEFAULT_ACTIVITY_OPTIONS = [
  "Ethical Hacking",
  "Capture The Flag",
  "Web Development",
  "Graphics Designer",
  "Management",
  "Art and Craft",
  "Content Writing",
  "Research Wing",
  "Other",
];

export const DEFAULT_SPECIALIZATION_OPTIONS = [
  "Video Editing",
  "Anchoring",
  "Graphics Design",
  "Photography",
  "Content Writing",
  "Management",
  "Cultural",
  "Other",
];

const normalizeKey = (value = "") => String(value).trim().toLowerCase();

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normalizeOptions = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  const output = [];
  for (const item of value.slice(0, 30)) {
    const clean = String(item || "").trim().slice(0, 100);
    if (clean && !output.includes(clean)) output.push(clean);
  }
  return output.length ? output : fallback;
};

const normalizeSections = (value = {}) => {
  const output = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_RECRUITMENT_SECTIONS)) {
    output[key] = Object.hasOwn(value, key) ? Boolean(value[key]) : defaultValue;
  }
  return output;
};

export const isFormAcceptingSubmissions = (form, now = new Date()) => {
  if (!form || form.status !== "open") return false;
  if (form.openAt && new Date(form.openAt) > now) return false;
  if (form.closeAt && new Date(form.closeAt) < now) return false;
  return true;
};

const serializeAdmin = (doc, stats = {}) => ({
  id: doc._id.toString(),
  formKey: doc.formKey,
  type: doc.type,
  title: doc.title,
  badge: doc.badge,
  intro: doc.intro,
  status: doc.status,
  openAt: doc.openAt,
  closeAt: doc.closeAt,
  sections: doc.sections,
  activityOptions: doc.activityOptions,
  specializationOptions: doc.specializationOptions,
  acceptingSubmissions: isFormAcceptingSubmissions(doc),
  submissions: stats.submissions || 0,
  latestSubmission: stats.latestSubmission || null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const serializePublic = (doc) => ({
  formKey: doc.formKey,
  type: doc.type,
  title: doc.title,
  badge: doc.badge,
  intro: doc.intro,
  status: doc.status,
  openAt: doc.openAt,
  closeAt: doc.closeAt,
  sections: doc.sections,
  activityOptions: doc.activityOptions,
  specializationOptions: doc.specializationOptions,
  acceptingSubmissions: isFormAcceptingSubmissions(doc),
});

const normalizePayload = (body = {}, existing = null) => {
  const formKey = normalizeKey(
    Object.hasOwn(body, "formKey") ? body.formKey : existing?.formKey || "",
  );
  const type = String(
    Object.hasOwn(body, "type") ? body.type : existing?.type || "recruitment",
  ).trim();
  const status = String(
    Object.hasOwn(body, "status") ? body.status : existing?.status || "draft",
  ).trim();

  if (!FORM_KEY_RE.test(formKey)) {
    return { error: "Form key must use lowercase letters, numbers and hyphens" };
  }
  if (!TYPES.has(type)) return { error: "Unsupported form type" };
  if (!STATUSES.has(status)) return { error: "Invalid form status" };

  const title = String(
    Object.hasOwn(body, "title") ? body.title : existing?.title || "",
  ).trim().slice(0, 180);
  if (!title) return { error: "Form title is required" };

  const openAt = Object.hasOwn(body, "openAt")
    ? normalizeDate(body.openAt)
    : existing?.openAt || null;
  const closeAt = Object.hasOwn(body, "closeAt")
    ? normalizeDate(body.closeAt)
    : existing?.closeAt || null;

  if (openAt === undefined || closeAt === undefined) {
    return { error: "Opening/closing date is invalid" };
  }
  if (openAt && closeAt && openAt >= closeAt) {
    return { error: "Closing date must be after opening date" };
  }

  return {
    value: {
      formKey,
      type,
      title,
      badge: String(
        Object.hasOwn(body, "badge") ? body.badge : existing?.badge || "Member Recruitment",
      ).trim().slice(0, 80),
      intro: String(
        Object.hasOwn(body, "intro")
          ? body.intro
          : existing?.intro ||
            "Explore cybersecurity, build real-world skills, participate in CTFs, collaborate with passionate students and become part of the EWU Cyber Security Club.",
      ).trim().slice(0, 900),
      status,
      openAt,
      closeAt,
      sections: normalizeSections(
        Object.hasOwn(body, "sections") ? body.sections : existing?.sections,
      ),
      activityOptions: normalizeOptions(
        Object.hasOwn(body, "activityOptions")
          ? body.activityOptions
          : existing?.activityOptions,
        DEFAULT_ACTIVITY_OPTIONS,
      ),
      specializationOptions: normalizeOptions(
        Object.hasOwn(body, "specializationOptions")
          ? body.specializationOptions
          : existing?.specializationOptions,
        DEFAULT_SPECIALIZATION_OPTIONS,
      ),
    },
  };
};

const submissionStatsByKey = async () => {
  const collection = await getFormSubmissionCollection();
  const rows = await collection
    .aggregate([
      {
        $group: {
          _id: "$formKey",
          submissions: { $sum: 1 },
          latestSubmission: { $max: "$submittedAt" },
        },
      },
    ])
    .toArray();

  return new Map(rows.map((row) => [row._id, row]));
};

export const listFormDefinitionsAdmin = async (req, res) => {
  try {
    const [definitions, stats] = await Promise.all([
      (await getFormDefinitionCollection())
        .find({})
        .sort({ updatedAt: -1 })
        .limit(200)
        .toArray(),
      submissionStatsByKey(),
    ]);

    return res.send({
      forms: definitions.map((doc) => serializeAdmin(doc, stats.get(doc.formKey))),
    });
  } catch (error) {
    console.error("Form definitions list error:", error);
    return res.status(500).send({ message: "Failed to load form definitions" });
  }
};

export const createFormDefinition = async (req, res) => {
  try {
    const normalized = normalizePayload(req.body);
    if (normalized.error) return res.status(400).send({ message: normalized.error });

    const collection = await getFormDefinitionCollection();
    const existing = await collection.findOne({ formKey: normalized.value.formKey });
    if (existing) {
      return res.status(409).send({ message: "A form with this key already exists" });
    }

    const now = new Date();
    const doc = {
      ...normalized.value,
      createdBy: req.user.uid,
      updatedBy: req.user.uid,
      createdAt: now,
      updatedAt: now,
    };

    if (doc.status === "open") {
      await collection.updateMany(
        { type: "recruitment", status: "open" },
        { $set: { status: "closed", updatedAt: now, updatedBy: req.user.uid } },
      );
    }

    const result = await collection.insertOne(doc);
    return res.status(201).send({
      message: "Recruitment form created",
      form: serializeAdmin({ ...doc, _id: result.insertedId }),
    });
  } catch (error) {
    console.error("Create form definition error:", error);
    return res.status(500).send({ message: "Failed to create form" });
  }
};

export const updateFormDefinition = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid form ID" });
    }

    const collection = await getFormDefinitionCollection();
    const existing = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).send({ message: "Form not found" });

    const normalized = normalizePayload(req.body, existing);
    if (normalized.error) return res.status(400).send({ message: normalized.error });

    const duplicate = await collection.findOne({
      formKey: normalized.value.formKey,
      _id: { $ne: existing._id },
    });
    if (duplicate) {
      return res.status(409).send({ message: "A form with this key already exists" });
    }

    const now = new Date();
    if (normalized.value.status === "open") {
      await collection.updateMany(
        {
          _id: { $ne: existing._id },
          type: "recruitment",
          status: "open",
        },
        { $set: { status: "closed", updatedAt: now, updatedBy: req.user.uid } },
      );
    }

    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          ...normalized.value,
          updatedAt: now,
          updatedBy: req.user.uid,
        },
      },
    );

    const changed = await collection.findOne({ _id: existing._id });
    const stats = (await submissionStatsByKey()).get(changed.formKey);

    return res.send({
      message: "Recruitment form updated",
      form: serializeAdmin(changed, stats),
    });
  } catch (error) {
    console.error("Update form definition error:", error);
    return res.status(500).send({ message: "Failed to update form" });
  }
};

export const deleteFormDefinition = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid form ID" });
    }

    const collection = await getFormDefinitionCollection();
    const existing = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing) return res.status(404).send({ message: "Form not found" });

    const submissions = await (await getFormSubmissionCollection()).countDocuments({
      formKey: existing.formKey,
    });
    if (submissions > 0) {
      return res.status(409).send({
        message: "This form has submissions. Archive it instead of deleting it.",
      });
    }

    await collection.deleteOne({ _id: existing._id });
    return res.send({ message: "Form deleted" });
  } catch (error) {
    console.error("Delete form definition error:", error);
    return res.status(500).send({ message: "Failed to delete form" });
  }
};

export const getActiveRecruitmentForm = async (req, res) => {
  try {
    const collection = await getFormDefinitionCollection();
    const candidates = await collection
      .find({ type: "recruitment", status: "open" })
      .sort({ openAt: -1, updatedAt: -1 })
      .limit(20)
      .toArray();

    const active = candidates.find((form) => isFormAcceptingSubmissions(form));
    return res.send({ form: active ? serializePublic(active) : null });
  } catch (error) {
    console.error("Active recruitment form error:", error);
    return res.status(500).send({ message: "Failed to load active recruitment" });
  }
};

export const getPublicFormDefinition = async (req, res) => {
  try {
    const formKey = normalizeKey(req.params.formKey);
    if (!FORM_KEY_RE.test(formKey)) {
      return res.status(400).send({ message: "Invalid form key" });
    }

    const form = await (await getFormDefinitionCollection()).findOne({ formKey });
    if (!form || form.status === "archived") {
      return res.status(404).send({ message: "Form not found" });
    }

    return res.send({ form: serializePublic(form) });
  } catch (error) {
    console.error("Public form definition error:", error);
    return res.status(500).send({ message: "Failed to load form" });
  }
};
