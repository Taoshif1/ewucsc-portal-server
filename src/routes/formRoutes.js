import express from "express";
import {
  exportFormCsv,
  getFormSummary,
  listFormSubmissions,
  submitForm,
} from "../controllers/formSubmissionController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.post("/:formKey", submitForm);

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

export default router;
