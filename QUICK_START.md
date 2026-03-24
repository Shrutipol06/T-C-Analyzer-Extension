# Quick Start Guide - Login & History Features

## What's New?

Your TermAlert extension now has **Firebase Authentication** integrated! This means:

✅ **Users must log in** to save their scan history  
✅ **Secure authentication** using Firebase  
✅ **New Login tab** in the extension UI  
✅ **Automatic history management** based on login state  

---

## Getting Started (3 Steps)

### Step 1️⃣: Set Up Firebase (2 minutes)
1. Go to https://console.firebase.google.com
2. Create a new project (or use existing one)
3. Click "Create web app" (the `</>` icon)
4. Copy your Firebase config (you'll see something like this):
   ```javascript
   {
     apiKey: "AIzaSyD...",
     authDomain: "myapp.firebaseapp.com",
     projectId: "myapp-12345",
     ...
   }
   ```

### Step 2️⃣: Configure the Extension (1 minute)
1. Open `firebase-config.js` in the extension folder
2. Replace the `YOUR_*` placeholder values with your Firebase credentials
3. Save the file

### Step 3️⃣: Enable Authentication (1 minute)
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Find and click **Email/Password**
3. Toggle **Enable** and click **Save**
4. In your browser, go to `chrome://extensions/`
5. Find "T&C Analyzer — Risk Shield"
6. Click the **reload** icon

---

## How to Use

### Logging In
1. Click the **Login** tab (👤 icon) in the extension
2. Enter your email and password
3. Click **Sign In** or **Create New Account**
4. Once logged in, you'll see your email displayed

### Scanning Pages
- **When logged in**: Your scans are automatically saved to history ✅
- **When NOT logged in**: Scans still work, but won't be saved to history ⚠️

### Viewing History
1. Click the **History** tab (🕓 icon)
2. See all your previous scans
   - Shows site name, risk score, and when you scanned it
   - Click the **Clear History** button to remove all items

### Logging Out
1. Click the **Login** tab (👤 icon)
2. Click the **Sign Out** button
3. You'll be logged out (but your local history remains)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Login/Sign Up** | Create account or log in with email/password |
| **Conditional History** | History only saves when you're logged in |
| **Error Messages** | Clear feedback if something goes wrong |
| **Auto-Save** | Once logged in, every scan auto-saves to history |
| **Multi-Device Ready** | Foundation for future cloud sync |

---

## Troubleshooting

### "Firebase is not configured"
→ Make sure you updated `firebase-config.js` with YOUR Firebase credentials (not the placeholder values)

### "Please log in to save scan history"
→ This is normal! Just sign in from the Login tab first

### Sign-in not working
→ Check that Email/Password auth is enabled in Firebase Console > Authentication > Sign-in method

### History disappeared after logging out
→ Your local history stays, but you need to log back in to see it

---

## What Gets Saved?

When you log in and scan, we save:
- 📍 **Site name** (domain)
- 🔗 **Page URL**
- 📊 **Risk score** (0-100)
- 📋 **Number of clauses found**
- ⏰ **Timestamp** (when you scanned)

**We do NOT save**: Full page content, personal browsing history, or anything beyond what's listed above.

---

## Privacy & Security

🔐 **Your Firebase Project**: You create and control it  
🔒 **Your Data**: Stored in your own Firebase account  
✅ **No Tracking**: We don't store or track user behavior  
🛡️ **Encrypted**: Firebase uses industry-standard encryption  

---

## Need More Details?

📖 See **`FIREBASE_SETUP.md`** for complete setup instructions  
📋 See **`IMPLEMENTATION_SUMMARY.md`** for technical details  

---

## Support

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Verify your Firebase config in `firebase-config.js`
3. Ensure Email/Password auth is enabled in Firebase
4. Reload the extension with the↻ button at `chrome://extensions/`

Enjoy your enhanced TermAlert experience! 🚀
