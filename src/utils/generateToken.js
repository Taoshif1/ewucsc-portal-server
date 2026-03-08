import jwt from "jsonwebtoken";

export const generateToken = (user) => {

  return jwt.sign(
    {
      uid: user.uid,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

};