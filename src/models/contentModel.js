import { connectDB } from "../config/db.js";

const COLLECTIONS = {
  announcements: "announcements",
  blogs: "blogs",
};

export const getContentCollection = async (type) => {
  const collectionName = COLLECTIONS[type];

  if (!collectionName) {
    throw new Error("Unsupported content type");
  }

  const db = await connectDB();
  const collection = db.collection(collectionName);
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ published: 1, archived: 1, publishedAt: -1 });
  await collection.createIndex({ archived: 1, updatedAt: -1 });
  return collection;
};
