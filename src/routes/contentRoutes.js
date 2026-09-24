import express from "express";
import {
  createContent,
  listAllContent,
  listPublishedContent,
  getPublishedContentBySlug,
  updateContent,
} from "../controllers/contentController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/:type", listPublishedContent);
router.get("/:type/:slug", getPublishedContentBySlug);

router.get(
  "/:type/admin/all",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  listAllContent,
);
router.post(
  "/:type/admin",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  createContent,
);
router.patch(
  "/:type/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  updateContent,
);

export default router;
