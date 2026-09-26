import express from "express";
import {
  createVpResource,
  deleteVpResource,
  listAllVpResources,
  listPublishedVpResources,
  updateVpResource,
} from "../controllers/vpResourceController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/", listPublishedVpResources);

router.get(
  "/admin/all",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  listAllVpResources,
);

router.post(
  "/admin",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  createVpResource,
);

router.patch(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  updateVpResource,
);

router.delete(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  deleteVpResource,
);

export default router;
