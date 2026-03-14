import { getUserCollection } from "../models/userModel.js";
import { generateToken } from "../utils/generateToken.js";

export const createUser = async (req, res) => {

  const users = await getUserCollection();

  const { uid, name, email } = req.body;

    // verify firebase user
  if (req.firebaseUser.uid !== uid) {
    return res.status(403).send("UID mismatch");
  }

  const existingUser = await users.findOne({ uid });

    if (existingUser) {

    const token = generateToken(existingUser);

    return res.send({
      user: existingUser,
      token
    });
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


export const loginUser = async (req, res) => {

  const users = await getUserCollection();

  const uid = req.firebaseUser.uid;

  const user = await users.findOne({ uid });

  if (!user) {
    return res.status(404).send("User not found");
  }

  const token = generateToken(user);

  res.send({ user, token });

};
