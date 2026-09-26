import { connectDB } from "../config/db.js";

export const getSiteSettingsCollection = async () => {
  const db = await connectDB();
  const collection = db.collection("siteSettings");
  await collection.createIndex({ key: 1 }, { unique: true });
  return collection;
};
