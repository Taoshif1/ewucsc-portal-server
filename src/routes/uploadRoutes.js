import express from "express";
import {
  deleteAsset,
  getPrivateAsset,
  getPublicAsset,
  uploadAsset,
} from "../controllers/uploadController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/public/:id", getPublicAsset);
router.get("/private/:id", verifyJWT, verifyApprovedMember, getPrivateAsset);

router.post(
  "/:scope",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  express.raw({ type: "application/octet-stream", limit: "10mb" }),
  uploadAsset,
);

router.delete(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  deleteAsset,
);

export default router;
