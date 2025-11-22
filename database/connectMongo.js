import mongoose from "mongoose";
import { DB_NAME } from "./Constants.js";

let dbConnection = null;

export const connectToMongo = async () => {
  try {
    const uri = `${process.env.MONGO_URI}/${DB_NAME}`;
    console.log("Connecting to:", uri);
    dbConnection = await mongoose.connect(uri);
    console.log("✅ Connected to IndexDB");
  } catch (error) {
    console.error("❌ Error connecting to IndexDB:", error);
    throw new Error("Failed to connect to IndexDB");
  }
};

