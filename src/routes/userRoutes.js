import express from "express";
import { createUser, loginUser } from "../controllers/userController.js";
import { verifyFirebase } from "../middleware/verifyFirebase.js";
import { verifyJWT } from "../middleware/verifyJWT.js";
import { getUserCollection } from "../models/userModel.js";

const router = express.Router();


router.get("/profile", verifyJWT, async (req, res) => {
  try {
    const users = await getUserCollection();

    const user = await users.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({
      message: "Protected route working",
      user,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).send({ message: "Failed to fetch profile" });
  }
});

router.post("/users", verifyFirebase, createUser);
router.post("/login", verifyFirebase, loginUser);


export default router;