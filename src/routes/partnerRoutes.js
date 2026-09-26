import express from "express";
import {
  createPartner,
  deletePartner,
  listAllPartners,
  listPartners,
  updatePartner,
} from "../controllers/partnerController.js";
import { allowRoles } from "../middleware/allowRoles.js";
import { verifyApprovedMember } from "../middleware/verifyApprovedMember.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/", listPartners);

router.get(
  "/admin/all",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  listAllPartners,
);
router.post(
  "/admin",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  createPartner,
);
router.patch(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  updatePartner,
);
router.delete(
  "/admin/:id",
  verifyJWT,
  verifyApprovedMember,
  allowRoles("admin"),
  deletePartner,
);

export default router;
