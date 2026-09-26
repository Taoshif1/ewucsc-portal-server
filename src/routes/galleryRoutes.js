import express from "express";
import {
  createGalleryItem,
  deleteGalleryItem,
  listAllGallery,
  listGallery,
  updateGalleryItem,
} from "../controllers/galleryController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/", listGallery);

router.get(
  "/admin/all",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  listAllGallery,
);
router.post(
  "/admin",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  createGalleryItem,
);
router.patch(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  updateGalleryItem,
);
router.delete(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin", "executive"),
  deleteGalleryItem,
);

export default router;
