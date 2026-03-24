# TermAlert — Firebase Authentication Setup

This extension now includes **Firebase Authentication** to securely save your scan history. Follow these steps to enable it:

## Step 1: Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Enter a project name (e.g., "TermAlert")
4. Click through the setup steps
5. Once created, click **"Create web app"** (the `</> ` icon)
6. Register the web app with a name

## Step 2: Get Your Firebase Configuration

After registering the web app, you will see a code snippet like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDy9WatAOxC8MauF_vUBXmFFyR3n9Qj4G0",
  authDomain: "ai-medical-report-analyz-16cd5.firebaseapp.com",
  projectId: "ai-medical-report-analyz-16cd5",
  storageBucket: "ai-medical-report-analyz-16cd5.firebasestorage.app",
  messagingSenderId: "177573733328",
  appId: "1:177573733328:web:3efceb8f9d674625abcfd5",
  measurementId: "G-X1DWNDPWBQ"
};
```

## Step 3: Update firebase-config.js

1. Open `firebase-config.js` in the extension directory
2. Replace the placeholder values with your actual Firebase config values
3. Example:
   ```javascript
   window.firebaseConfig = {
     apiKey: "AIzaSyDx...",
     authDomain: "myproject.firebaseapp.com",
     projectId: "myproject-abcd1234",
     storageBucket: "myproject-abcd1234.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcd1234efgh5678"
   };
   ```

## Step 4: Enable Authentication Methods

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Email/Password**
3. Toggle **Enable** to turn it on
4. Click **Save**

## Step 5: Reload the Extension

1. Go to `chrome://extensions/`
2. Find "T&C Analyzer — Risk Shield"
3. Click the **reload icon** (circular arrow)

## Features

✅ **Login Tab**: Navigate to the Login tab and create an account or sign in
✅ **Secure Auth**: Uses Firebase Authentication (industry-standard security)
✅ **History Saved**: Once logged in, your scan history will be saved automatically
✅ **Logout**: Sign out anytime from the Login tab

## Troubleshooting

### "Firebase is not configured"
- Ensure you've updated `firebase-config.js` with your actual Firebase credentials
- Check that none of the values say "YOUR_API_KEY" or similar placeholders

### Authentication not working
- Ensure Email/Password auth is enabled in Firebase Console -> Authentication -> Sign-in method
- Check browser console (F12) for any error messages
- Refresh the extension

### History not saving
- Make sure you're logged in (check the Login tab)
- Ensure the "Save History" toggle is enabled in Settings
- Both conditions must be true for history to be saved

## Privacy

Your Firebase project is your own, and you control all the data. The extension only stores:
- Email address (for authentication)
- Scan results (site name, URL, score, clause count, timestamp)

No personal browsing data or content is sent to any external service except Firebase for authenticated users.

## Need Help?

Check the [Firebase documentation](https://firebase.google.com/docs) or the [Chrome Extension documentation](https://developer.chrome.com/docs/extensions/)
