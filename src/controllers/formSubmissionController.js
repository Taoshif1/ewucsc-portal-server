import { getFormSubmissionCollection } from "../models/formSubmissionModel.js";
import { getFormDefinitionCollection } from "../models/formDefinitionModel.js";
import { isFormAcceptingSubmissions } from "./formDefinitionController.js";

const FORM_KEY_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;
const EWU_STUDENT_ID_RE = /^\d{4}-\d-\d{2}-\d{2,3}$/;

const normalizeFormKey = (value = "") => String(value).trim().toLowerCase();

const normalizeFieldValue = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => normalizeFieldValue(item))
      .join(" | ")
      .slice(0, 5000);
  }
  if (typeof value === "object") return JSON.stringify(value).slice(0, 5000);
  return String(value).trim().slice(0, 5000);
};

const sanitizeData = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const entries = Object.entries(data).slice(0, 60);
  const sanitized = {};

  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey)
      .trim()
      .replace(/[^a-zA-Z0-9 _/-]/g, "")
      .slice(0, 80);

    if (!key) continue;
    sanitized[key] = normalizeFieldValue(rawValue);
  }

  return sanitized;
};

const csvEscape = (value) =>
  '"' + String(value ?? "").replaceAll('"', '""').replace(/\r?\n/g, " ") + '"';

const validateRecruitmentBasics = (definition, data) => {
  if (!definition?.sections?.personal) return null;

  const required = [
    "Full Name",
    "Student ID",
    "University Email",
    "Department",
    "Current Semester",
  ];

  for (const field of required) {
    if (!String(data[field] || "").trim()) {
      return `${field} is required`;
    }
  }

  const studentId = String(data["Student ID"] || "").trim().replace(/\s+/g, "");
  if (!EWU_STUDENT_ID_RE.test(studentId)) {
    return "Enter a valid EWU Student ID";
  }

  const email = String(data["University Email"] || "").trim().toLowerCase();
  const expectedEmail = `${studentId}@std.ewubd.edu`.toLowerCase();

  if (email !== expectedEmail) {
    return "University email must match your EWU Student ID";
  }

  return null;
};

export const submitForm = async (req, res) => {
  try {
    const formKey = normalizeFormKey(req.params.formKey);

    if (!FORM_KEY_RE.test(formKey)) {
      return res.status(400).send({ message: "Invalid form key" });
    }

    const definition = await (await getFormDefinitionCollection()).findOne({ formKey });
    if (!definition) {
      return res.status(404).send({ message: "This form does not exist" });
    }
    if (!isFormAcceptingSubmissions(definition)) {
      return res.status(409).send({ message: "This recruitment form is not accepting submissions" });
    }

    const data = sanitizeData(req.body?.data);
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).send({ message: "Form data is required" });
    }

    if (data.website) {
      return res.status(201).send({ message: "Submission received" });
    }

    const validationError = validateRecruitmentBasics(definition, data);
    if (validationError) {
      return res.status(400).send({ message: validationError });
    }

    const collection = await getFormSubmissionCollection();
    const doc = {
      formKey,
      definitionId: definition._id,
      data,
      source: String(req.body?.source || "").trim().slice(0, 300),
      submittedAt: new Date(),
      userAgent: String(req.get("user-agent") || "").slice(0, 400),
    };

    await collection.insertOne(doc);
    return res.status(201).send({ message: "Application submitted successfully" });
  } catch (error) {
    console.error("Form submission error:", error);
    return res.status(500).send({ message: "Failed to submit form" });
  }
};

export const getFormSummary = async (req, res) => {
  try {
    const collection = await getFormSubmissionCollection();
    const summary = await collection
      .aggregate([
        {
          $group: {
            _id: "$formKey",
            submissions: { $sum: 1 },
            latestSubmission: { $max: "$submittedAt" },
          },
        },
        { $sort: { latestSubmission: -1 } },
      ])
      .toArray();

    return res.send({
      forms: summary.map((item) => ({
        formKey: item._id,
        submissions: item.submissions,
        latestSubmission: item.latestSubmission,
      })),
    });
  } catch (error) {
    console.error("Form summary error:", error);
    return res.status(500).send({ message: "Failed to load form data" });
  }
};

export const listFormSubmissions = async (req, res) => {
  try {
    const formKey = normalizeFormKey(req.params.formKey);
    if (!FORM_KEY_RE.test(formKey)) {
      return res.status(400).send({ message: "Invalid form key" });
    }

    const collection = await getFormSubmissionCollection();
    const rows = await collection
      .find({ formKey })
      .sort({ submittedAt: -1 })
      .limit(1000)
      .toArray();

    return res.send({
      submissions: rows.map((row) => ({
        id: row._id.toString(),
        data: row.data || {},
        source: row.source || "",
        submittedAt: row.submittedAt,
      })),
    });
  } catch (error) {
    console.error("Form submissions list error:", error);
    return res.status(500).send({ message: "Failed to load submissions" });
  }
};

export const exportFormCsv = async (req, res) => {
  try {
    const formKey = normalizeFormKey(req.params.formKey);
    if (!FORM_KEY_RE.test(formKey)) {
      return res.status(400).send({ message: "Invalid form key" });
    }

    const collection = await getFormSubmissionCollection();
    const rows = await collection.find({ formKey }).sort({ submittedAt: 1 }).toArray();

    const fieldNames = [];
    const seen = new Set();

    for (const row of rows) {
      for (const key of Object.keys(row.data || {})) {
        if (!seen.has(key)) {
          seen.add(key);
          fieldNames.push(key);
        }
      }
    }

    const headers = ["submittedAt", ...fieldNames];
    const lines = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) =>
        [
          row.submittedAt?.toISOString?.() || row.submittedAt || "",
          ...fieldNames.map((field) => row.data?.[field] ?? ""),
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${formKey}-submissions.csv"`,
    );

    return res.send("\uFEFF" + lines.join("\n"));
  } catch (error) {
    console.error("Form CSV export error:", error);
    return res.status(500).send({ message: "Failed to export form data" });
  }
};
