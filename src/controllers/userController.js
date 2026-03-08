import { getUserCollection } from "../models/userModel.js";
import { generateToken } from "../utils/generateToken.js";

export const createUser = async (req, res) => {

  const users = await getUserCollection();

  const { uid, name, email } = req.body;

  const existingUser = await users.findOne({ uid });

  if (existingUser) {
    return res.send(existingUser);
  }

  const newUser = {
    uid,
    name,
    email,
    role: "member",
    ctfScore: 0,
    createdAt: new Date(),
    isActive: true
  };

  await users.insertOne(newUser);

  const token = generateToken(newUser);

  res.send({
    user: newUser,
    token
  });

};