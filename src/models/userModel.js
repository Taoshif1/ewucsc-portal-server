import { connectDB } from "../config/db.js";

export const getUserCollection = async () => {

  const db = await connectDB();
  return db.collection("users");

};