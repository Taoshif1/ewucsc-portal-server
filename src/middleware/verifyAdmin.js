import { getUserCollection } from "../models/userModel.js";

export const verifyAdmin = async (req, res, next) => {
  try {
    const users = await getUserCollection();
    const user = await users.findOne({ uid: req.user.uid });

    const approvalStatus = user?.approvalStatus || "approved";

    if (
      !user ||
      user.role !== "admin" ||
      user.isActive === false ||
      approvalStatus !== "approved"
    ) {
      return res.status(403).send({ message: "Admin access required" });
    }

    req.adminUser = user;
    return next();
  } catch (error) {
    console.error("Admin verification error:", error);
    return res.status(500).send({ message: "Unable to verify admin access" });
  }
};
