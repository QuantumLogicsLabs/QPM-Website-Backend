import { Router } from "express";
import multer from "multer";
import { Package } from "../models/Package.js";
import { PackageVersion } from "../models/PackageVersion.js";
import { uploadTarballToDrive, downloadTarballFromDrive } from "../services/googleDrive.js";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth.js";

const router = Router();
const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max limit

// GET /api/registry/search - Search packages
router.get("/search", async (req, res) => {
  try {
    const term = (req.query.q || "").toString().trim();
    let filter = {};

    if (term) {
      filter = {
        $or: [
          { name: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
          { keywords: { $regex: term, $options: "i" } }
        ]
      };
    }

    const packages = await Package.find(filter)
      .populate("owner", "username email")
      .sort({ downloads: -1, updatedAt: -1 })
      .limit(50);

    return res.json({
      objects: packages.map((p) => ({
        name: p.name,
        description: p.description,
        keywords: p.keywords,
        latest_version: p.latestVersion,
        downloads: p.downloads,
        updated_at: p.updatedAt,
        owner: p.owner ? p.owner.username : "anonymous"
      })),
      total: packages.length
    });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ error: err.message || "Failed to search packages." });
  }
});

// GET /api/registry/user/my-packages - Get packages owned by logged in user
router.get("/user/my-packages", authenticateToken, async (req, res) => {
  try {
    const packages = await Package.find({ owner: req.user._id })
      .sort({ updatedAt: -1 });
    return res.json({ packages });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch user packages." });
  }
});

// GET /api/registry/:name - Get package metadata (QPM CLI & NPM compatible)
router.get("/:name", async (req, res) => {
  try {
    const name = req.params.name.toLowerCase();
    const origin = `${req.protocol}://${req.get("host")}`;

    const pkg = await Package.findOne({ name }).populate("owner", "username email");
    if (!pkg) {
      return res.status(404).json({ error: `Package "${name}" not found.` });
    }

    const versions = await PackageVersion.find({ package: pkg._id }).sort({ createdAt: -1 });

    const versionMap = {};
    const timeMap = {};

    for (const v of versions) {
      versionMap[v.version] = {
        name: pkg.name,
        version: v.version,
        description: v.description,
        dependencies: Object.fromEntries(v.dependencies || new Map()),
        dist: {
          tarball: `${origin}/api/registry/${pkg.name}/-/${pkg.name}-${v.version}.tgz`,
          shasum: v.shasum || "verified",
          unpackedSize: v.file_size || 0
        }
      };
      timeMap[v.version] = v.createdAt;
    }

    return res.json({
      name: pkg.name,
      description: pkg.description,
      keywords: pkg.keywords,
      license: pkg.license,
      homepage: pkg.homepage,
      repository: pkg.repository,
      readme: pkg.readme,
      downloads: pkg.downloads || 0,
      owner: pkg.owner ? pkg.owner.username : "anonymous",
      "dist-tags": { latest: pkg.latestVersion },
      versions: versionMap,
      time: timeMap
    });
  } catch (err) {
    console.error("Fetch package error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch package details." });
  }
});

// GET /api/registry/:name/-/:file - Download tarball (.tgz) streamed from Google Drive
router.get("/:name/-/:file", async (req, res) => {
  try {
    const { name, file } = req.params;
    const cleanName = name.toLowerCase();
    const version = file.replace(`${cleanName}-`, "").replace(".tgz", "");

    const pkg = await Package.findOne({ name: cleanName });
    if (!pkg) {
      return res.status(404).json({ error: "Package not found" });
    }

    const v = await PackageVersion.findOne({ package: pkg._id, version });
    if (!v || !v.driveFileId) {
      return res.status(404).json({ error: "Package version or tarball file not found" });
    }

    // Increment download count
    pkg.downloads = (pkg.downloads || 0) + 1;
    await pkg.save();

    // Stream tarball directly from Google Drive
    const tarballBuffer = await downloadTarballFromDrive(v.driveFileId);

    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${v.tarballName || `${cleanName}-${version}.tgz`}"`);
    res.setHeader("Content-Length", tarballBuffer.length.toString());
    return res.status(200).send(tarballBuffer);
  } catch (err) {
    console.error("Error serving tarball from Google Drive:", err);
    return res.status(500).json({ error: err.message || "Failed to download package from Google Drive" });
  }
});

// POST /api/registry/publish - Publish package (handles JSON base64 or Multipart form-data file)
router.post("/publish", optionalAuthenticateToken, upload.single("file"), async (req, res) => {
  try {
    let { name, version, description, keywords, license, repository, homepage, readme, dependencies, fileBase64 } = req.body;

    if (!name || !version) {
      return res.status(400).json({ error: "Package name and version are required." });
    }

    name = name.toLowerCase().trim();
    version = version.trim();

    // Extract file buffer from multipart upload OR base64 payload
    let fileBuffer = Buffer.from("");
    if (req.file && req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (fileBase64) {
      const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
      fileBuffer = Buffer.from(cleanBase64, "base64");
    }

    if (typeof keywords === "string") {
      keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }

    let parsedDeps = {};
    if (typeof dependencies === "string") {
      try {
        parsedDeps = JSON.parse(dependencies);
      } catch (e) {
        parsedDeps = {};
      }
    } else if (dependencies && typeof dependencies === "object") {
      parsedDeps = dependencies;
    }

    // Check ownership in MongoDB
    let existingPkg = await Package.findOne({ name });
    const currentUserId = req.user ? req.user._id : null;

    if (existingPkg && existingPkg.owner && currentUserId) {
      if (existingPkg.owner.toString() !== currentUserId.toString()) {
        return res.status(403).json({ error: `Package "${name}" belongs to another author.` });
      }
    }

    if (!existingPkg) {
      existingPkg = new Package({
        name,
        description: description || "",
        keywords: keywords || [],
        license: license || "MIT",
        repository: repository || "",
        homepage: homepage || "",
        readme: readme || `# ${name}\n\n${description || "No documentation provided."}`,
        latestVersion: version,
        owner: currentUserId
      });
      await existingPkg.save();
    } else {
      // Check if version already exists
      const existingVer = await PackageVersion.findOne({ package: existingPkg._id, version });
      if (existingVer) {
        return res.status(400).json({ error: `Version ${version} of package "${name}" is already published.` });
      }

      existingPkg.description = description || existingPkg.description;
      existingPkg.keywords = keywords || existingPkg.keywords;
      existingPkg.latestVersion = version;
      if (readme) existingPkg.readme = readme;
      await existingPkg.save();
    }

    // Upload archive file to Google Drive
    const tarballName = `${name.replace("/", "-")}-${version}.tgz`;
    const driveResult = await uploadTarballToDrive(tarballName, fileBuffer);

    // Save version in MongoDB
    const packageVersion = new PackageVersion({
      package: existingPkg._id,
      version,
      description: description || "",
      dependencies: parsedDeps,
      readme: readme || "",
      tarballName,
      driveFileId: driveResult.id,
      fileSize: driveResult.size,
      publishedBy: currentUserId
    });

    await packageVersion.save();

    return res.status(201).json({
      message: `Package ${name}@${version} published successfully and stored in Google Drive!`,
      package: {
        name,
        version,
        driveFileId: driveResult.id,
        size: driveResult.size
      }
    });
  } catch (err) {
    console.error("Publish error:", err);
    return res.status(500).json({ error: err.message || "Failed to publish package." });
  }
});

export default router;
