import express from "express";
import {
  exportFormCsv,
  getFormSummary,
  listFormSubmissions,
  submitForm,
} from "../controllers/formSubmissionController.js";
import {
  createFormDefinition,
  deleteFormDefinition,
  getActiveRecruitmentForm,
  getPublicFormDefinition,
  listFormDefinitionsAdmin,
  updateFormDefinition,
} from "../controllers/formDefinitionController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/public/active", getActiveRecruitmentForm);
router.get("/public/:formKey", getPublicFormDefinition);

router.get(
  "/admin/definitions",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  listFormDefinitionsAdmin,
);
router.post(
  "/admin/definitions",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  createFormDefinition,
);
router.patch(
  "/admin/definitions/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  updateFormDefinition,
);
router.delete(
  "/admin/definitions/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  deleteFormDefinition,
);

router.get(
  "/admin/summary",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  getFormSummary,
);
router.get(
  "/:formKey/admin/all",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  listFormSubmissions,
);
router.get(
  "/:formKey/admin/export",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  exportFormCsv,
);

router.post("/:formKey", submitForm);

export default router;
