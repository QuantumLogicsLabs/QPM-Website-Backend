/**
 * Run this ONCE to authorize QPM against your personal Google Drive:
 *
 *   node src/scripts/get-refresh-token.js
 *
 * It opens Google's consent screen, catches the redirect on a local
 * server, and prints a refresh token. Paste that into .env as
 * GOOGLE_OAUTH_REFRESH_TOKEN. Refresh tokens don't expire unless you
 * revoke access, so you only do this once.
 */
import http from "http";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first (from the OAuth client JSON you downloaded).");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // forces a refresh_token even on repeat runs
    scope: "https://www.googleapis.com/auth/drive.file",
  }).toString();

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) return;

  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  res.end("Authorized — you can close this tab and return to the terminal.");
  server.close();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    console.error("\nNo refresh_token returned. Revoke QPM's access at https://myaccount.google.com/permissions and re-run this script.");
    console.error(tokens);
    process.exit(1);
  }

  console.log("\nSuccess. Add this to .env:\n");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log("");
  process.exit(0);
});

server.listen(PORT, () => {
  console.log("Opening the Google consent screen in your browser...");
  console.log(`If it doesn't open automatically, visit:\n\n${authUrl}\n`);
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${opener} "${authUrl}"`, () => {});
});