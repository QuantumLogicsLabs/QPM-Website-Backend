import dotenv from "dotenv";

dotenv.config();

/**
 * Google Drive API Service Module for QPM Registry
 * 
 * Uploads package tarballs (.tgz) to a Google Drive folder, downloads/streams tarballs
 * by driveFileId, and handles Service Account authentication.
 */

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey || privateKey.trim() === "" || clientEmail.includes("your-service-account")) {
    return null;
  }

  try {
    privateKey = privateKey.replace(/\\n/g, "\n");

    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };

    const b64url = (str) =>
      Buffer.from(typeof str === "string" ? str : JSON.stringify(str))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const unsignedToken = `${b64url(header)}.${b64url(claim)}`;

    const crypto = await import("crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(unsignedToken);
    const signature = sign.sign(privateKey, "base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${unsignedToken}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    });

    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error("Failed to generate Google Drive access token:", err);
    return null;
  }
}

/**
 * Uploads package tarball buffer to Google Drive.
 * Returns { id, size }
 */
export async function uploadTarballToDrive(fileName, buffer) {
  const token = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!token) {
    console.log(`[Google Drive] Credentials not set. Generating mock/local Drive File ID for ${fileName}`);
    return {
      id: `drive_file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      size: buffer.length
    };
  }

  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : []
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = Buffer.concat([
    Buffer.from(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
    ),
    Buffer.from(`${delimiter}Content-Type: application/gzip\r\n\r\n`),
    buffer,
    Buffer.from(closeDelimiter)
  ]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": multipartBody.length.toString()
    },
    body: multipartBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    size: buffer.length
  };
}

/**
 * Downloads a tarball buffer from Google Drive by driveFileId.
 * Returns Buffer
 */
export async function downloadTarballFromDrive(fileId) {
  const token = await getAccessToken();

  if (!token || fileId.startsWith("drive_file_")) {
    console.log(`[Google Drive] Serving local placeholder archive for ID ${fileId}`);
    return Buffer.from("");
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Deletes a tarball file from Google Drive.
 */
export async function deleteTarballFromDrive(fileId) {
  const token = await getAccessToken();
  if (!token || fileId.startsWith("drive_file_")) return;

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
}
