import express from "express";
import {
  getSiteSettings,
  updateSiteSettings,
} from "../controllers/siteSettingsController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/", getSiteSettings);

router.patch(
  "/admin",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  updateSiteSettings,
);

export default router;
