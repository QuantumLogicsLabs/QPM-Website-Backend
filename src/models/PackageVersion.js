import mongoose from "mongoose";

const packageVersionSchema = new mongoose.Schema(
  {
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true
    },
    version: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    dependencies: {
      type: Map,
      of: String,
      default: {}
    },
    readme: {
      type: String,
      default: ""
    },
    tarballName: {
      type: String,
      required: true
    },
    driveFileId: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    shasum: {
      type: String,
      default: ""
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    }
  },
  {
    timestamps: true
  }
);

packageVersionSchema.index({ package: 1, version: 1 }, { unique: true });

export const PackageVersion = mongoose.model("PackageVersion", packageVersionSchema);
