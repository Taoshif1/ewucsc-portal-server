import express from "express";
import { getUpcomingCtfs } from "../controllers/ctfController.js";

const router = express.Router();

router.get("/upcoming", getUpcomingCtfs);

export default router;
