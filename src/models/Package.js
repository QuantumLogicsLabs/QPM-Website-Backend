import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      default: ""
    },
    keywords: [
      {
        type: String,
        trim: true
      }
    ],
    license: {
      type: String,
      default: "MIT"
    },
    repository: {
      type: String,
      default: ""
    },
    homepage: {
      type: String,
      default: ""
    },
    readme: {
      type: String,
      default: ""
    },
    latestVersion: {
      type: String,
      required: true
    },
    downloads: {
      type: Number,
      default: 0
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    }
  },
  {
    timestamps: true
  }
);

packageSchema.index({ name: "text", description: "text", keywords: "text" });

export const Package = mongoose.model("Package", packageSchema);
