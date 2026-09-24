import { getUserCollection } from "../models/userModel.js";

export const verifyApprovedMember = async (req, res, next) => {
  try {
    const users = await getUserCollection();
    const user = await users.findOne({ uid: req.user.uid });

    if (!user) {
      return res.status(401).send({ message: "Member account not found" });
    }

    const approvalStatus = user.approvalStatus || "approved";

    if (user.isActive === false || approvalStatus !== "approved") {
      return res.status(403).send({
        message: "Approved EWUCSC membership is required",
        code: "MEMBERSHIP_ACCESS_DENIED",
      });
    }

    req.memberUser = user;
    return next();
  } catch (error) {
    console.error("Membership verification error:", error);
    return res.status(500).send({ message: "Unable to verify membership" });
  }
};
