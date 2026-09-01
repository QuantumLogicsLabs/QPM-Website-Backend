# QPM-Website-Backend

Created by a Commander on QuantumLogics Community.

# How To Add ENV KEYS 

# Step 1: Create a Google Cloud Service Account & Get JSON Key
Go to the Google Cloud Console.
Create a new project (or select an existing project).
Go to APIs & Services > Library, search for Google Drive API, and click Enable.
Go to APIs & Services > Credentials.
Click Create Credentials $\rightarrow$ Service Account.
Click on For Application
Enter a name (e.g. qpm-drive-bot) and click Create and Continue, then Done.
Click on the newly created Service Account email (e.g., qpm-drive-bot@your-project.iam.gserviceaccount.com).
Go to the Keys tab $\rightarrow$ Add Key $\rightarrow$ Create new key $\rightarrow$ Select JSON $\rightarrow$ Click Create.
A .json file will download to your computer.

# Step 2: Extract Credentials from the Downloaded JSON File
Open the downloaded JSON file in Notepad or VS Code. It will look like this:

json
{
  "type": "service_account",
  "project_id": "qpm-registry-45123",
  "private_key_id": "9a8b7c6d...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "qpm-drive-bot@qpm-registry-45123.iam.gserviceaccount.com"
}
client_email: Copy this email.
private_key: Copy the entire string (including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----).


# Step 3: Create a Google Drive Folder & Share Access
Open your regular Google Drive.
Create a new folder named QPM Packages.
Open the folder and look at the browser URL bar: https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j $\rightarrow$ The random string after /folders/ (e.g. 1a2b3c4d5e6f7g8h9i0j) is your GOOGLE_DRIVE_FOLDER_ID.
Important: Click Share on that folder, paste your Service Account email (qpm-drive-bot@...), give it Editor access, and click Share.
# Step 4: Add Keys to QPM-Website-Backend\.env
Open your 

d:\QuantumLogics\QPM-Website-Backend\.env
 file and paste your credentials:

env
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/qpm_registry
JWT_SECRET=quantum_package_manager_super_secret_jwt_key_2026
# Google Drive API Service Account Credentials
GOOGLE_CLIENT_EMAIL=qpm-drive-bot@qpm-registry-45123.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
GOOGLE_DRIVE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j

# Recap
# 1 Confirm .env has the client ID/secret first
Make sure GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are already saved in your .env file (from the Cloud Console popup). The script reads them from there — if they're missing it'll exit immediately with an error telling you so.<br>
# 2 Navigate to your project folder
Open a terminal, cd into your backend project root (the folder that has package.json and .env in it — same level as server.js). Make sure the script file exists at src/scripts/get-refresh-token.js — create that folder/file if you haven't yet, using the code I gave earlier.<br>
# 3 Run the script
Run: node src/scripts/get-refresh-token.js You should see "Opening the Google consent screen in your browser..." printed, and a browser tab should pop open automatically. If it doesn't open on its own, copy the long URL printed right below that message and paste it into your browser manually.<br>
# 4 Approve access in the browser
Sign in with the same Gmail address you added as a "Test user" in the OAuth consent screen setup. Google will show a warning like "Google hasn't verified this app" — that's expected since it's in Testing mode. Click "Continue" (you may need to click "Advanced" first to see that option), then approve the Drive permission it asks for.<br>
# 5 Copy the token from the terminal
After you approve, the browser tab will just say "Authorized — you can close this tab". Go back to your terminal — it will have printed a line like: GOOGLE_OAUTH_REFRESH_TOKEN=1//0gAbCdEfGhIjKlMn... Copy that whole line and paste it into your .env file.