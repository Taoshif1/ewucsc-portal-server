import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config(); 

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error("MONGO_URI is missing from .env file");
}

const client = new MongoClient(uri);

let db;

export const connectDB = async () => {
  if (!db) {
    try {
      await client.connect();
      db = client.db("ewucsc");
      console.log("✅ MongoDB Connected to EWUCSC");
    } catch (error) {
      console.error("❌ MongoDB Connection Error:", error);
      throw error;
    }
  }
  return db;
};
