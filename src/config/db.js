import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/qpm_registry";
    console.log(`Connecting to MongoDB at ${connStr.replace(/:([^:@]+)@/, ":****@")} ...`);
    
    await mongoose.connect(connStr);
    console.log("✅ MongoDB Connected successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    console.warn("⚠️ Continuing with in-memory / fallback store if MongoDB is offline...");
  }
};
