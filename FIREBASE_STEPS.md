# Firebase Setup - Step by Step Complete Guide

## 📋 Overview
This guide will walk you through setting up Firebase Authentication for your TermAlert extension. No coding experience needed!

**Total Time: ~10 minutes**

---

## Part 1: Create a Firebase Project

### Step 1: Go to Firebase Console
1. Open your browser and go to: **https://console.firebase.google.com**
2. Sign in with your Google account (create one if needed)

### Step 2: Create a New Project
1. Click the **"Create a project"** button (or **"Add project"**)
2. Enter a project name:
   - Example: `TermAlert` or `TermAlert-Auth`
3. Click **Continue**

### Step 3: Enable Google Analytics (Optional)
1. You'll see a checkbox "Enable Google Analytics for this project"
   - You can leave it **unchecked** for now
2. Click **Create Project**
3. Wait while Firebase sets up your project (takes ~1-2 minutes)

### Step 4: You're in the Firebase Console! ✅
- You should see your project name at the top left
- This is your Firebase project dashboard

---

## Part 2: Create a Web App

### Step 5: Register Web App
1. In the Firebase Console, look for these icons in the left navigation:
   - iOS icon 🍎
   - Android icon 🤖
   - **Web icon `</>`** ← Click this one!

2. Click the **Web icon `</>`**

### Step 6: Register App Settings
1. You'll see a popup asking for "App nickname"
   - Enter: `TermAlert Extension` (or any name)
2. Check the box: ☑️ "Also set up Firebase Hosting for this app"
   - Actually, **uncheck this** - you don't need Hosting
3. Click **Register app**

### Step 7: Copy Your Firebase Config
1. Firebase will show you code like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyABC123DEF456...",
  authDomain: "myproject-abcd1234.firebaseapp.com",
  projectId: "myproject-abcd1234",
  storageBucket: "myproject-abcd1234.appspot.com",
  messagingSenderId: "123456789012345",
  appId: "1:123456789:web:abcdef1234567890"
};
```

2. **Copy these values** (you'll paste them soon)
   - Keep this browser tab **OPEN** for reference

---

## Part 3: Enable Email/Password Authentication

### Step 8: Go to Authentication Settings
1. In the left sidebar of Firebase Console, find **"Build"** section
2. Click on **"Authentication"**

### Step 9: Go to Sign-in Method
1. Look for the **"Sign-in method"** tab at the top
2. Click it

### Step 10: Enable Email/Password
1. You'll see a list of sign-in methods (Google, GitHub, Email, etc.)
2. Find **"Email/Password"** in the list
3. Click on it to expand

### Step 11: Toggle Enable
1. You'll see a toggle switch at the top right of the Email/Password section
2. Click it to turn it **ON** (should be blue/colored when enabled)
3. Click **Save** button at the bottom right
4. You should see a checkmark or confirmation ✅

**Important:** Make sure it shows as "Enabled" (not "Disabled")

---

## Part 4: Add Your Config to the Extension

### Step 12: Find firebase-config.js
1. Open the folder where you extracted TermAlert
   - `c:\Users\shrut\Downloads\TermAlert-extension-v2\`
2. Find the file: **`firebase-config.js`**
3. Right-click → **Open with** → **Notepad** (or your favorite text editor)

### Step 13: Update the Configuration
You should see this in the file:
```javascript
window.firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Step 14: Copy-Paste Your Values
1. Go back to the Firebase tab (which you left open)
2. Find your config code from Step 7
3. Copy each value and replace the `YOUR_*` placeholders:

**Example - BEFORE:**
```javascript
apiKey: "YOUR_API_KEY",
```

**Example - AFTER (your actual key):**
```javascript
apiKey: "AIzaSyABC123DEF456xyz789...",
```

Do this for ALL 6 values:
- [ ] `apiKey`
- [ ] `authDomain`
- [ ] `projectId`
- [ ] `storageBucket`
- [ ] `messagingSenderId`
- [ ] `appId`

### Step 15: Save the File
1. Press **Ctrl+S** or go to **File → Save**
2. Close the text editor

**✅ Your firebase-config.js is now configured!**

---

## Part 5: Reload the Extension in Chrome

### Step 16: Open Chrome Extensions Page
1. Open **Google Chrome**
2. Type in the address bar: `chrome://extensions`
3. Press Enter

### Step 17: Find Your Extension
1. Look for **"T&C Analyzer — Risk Shield"**
2. You should see it in the list with an on/off toggle

### Step 18: Reload
1. Find the **circular arrow** icon (↻) at the bottom right of the extension card
2. Click it to reload the extension
3. Wait a few seconds for it to reload ✅

---

## Part 6: Test Your Setup

### Step 19: Open the Extension
1. Click the extension icon in your Chrome toolbar
2. The TermAlert popup should open

### Step 20: Test Login
1. Click the **Login** tab (👤 icon) in the popup
2. You should see a login form with:
   - Email input field
   - Password input field
   - "Sign In" button
   - "Create New Account" button

### Step 21: Create a Test Account
1. Enter an email: example@test.com
2. Enter a password: Test12345 (at least 6 characters)
3. Click **"Create New Account"**
4. You should see:
   - ✅ Success message with your email
   - A "Sign Out" button

### Step 22: Verify History Works
1. Click the **History** tab (🕓 icon)
2. Scan a page with the **Scan** tab
3. Your scan should appear in History ✅

### Step 23: Test Logout
1. Go back to **Login** tab
2. Click **"Sign Out"** button
3. Go to **History** tab
4. It should ask you to log in again

**🎉 Your Firebase is working!**

---

## 🆘 Troubleshooting

### Problem: "Firebase is not configured"
**Solution:**
- Did you replace ALL the `YOUR_*` placeholders in firebase-config.js?
- Make sure no value says "YOUR_API_KEY" or similar
- Save the file
- Reload the extension (↻ at chrome://extensions)

### Problem: "Can't create account"
**Solution:**
- Password must be at least 6 characters long
- Email must be a valid email address (example: test@gmail.com)
- Check that Email/Password is **enabled** in Firebase Console
  - Go to: Authentication → Sign-in method
  - Make sure Email/Password shows as "Enabled"

### Problem: "Login works but history doesn't save"
**Solution:**
- Make sure you're actually logged in (check Login tab)
- Make sure "Save History" toggle is ON in Settings tab
- Try scanning a page with history enabled while logged in

### Problem: "Extension doesn't load"
**Solution:**
- Go to chrome://extensions
- Find your extension
- Click the reload button (↻)
- If still broken, check if there are any red error messages
- Note the error and check firebase-config.js for typos

### Problem: "Error when creating account: Email already in use"
**Solution:**
- That email already has an account
- Try with a different email address
- Or click "Sign In" if you know the password

---

## ✅ Verification Checklist

Before you're done, verify:

- [ ] Firebase project created
- [ ] Web app registered in Firebase
- [ ] Email/Password authentication enabled
- [ ] firebase-config.js updated with YOUR values
- [ ] Extension reloaded in Chrome
- [ ] Login tab appears in extension
- [ ] Can create new account
- [ ] Can log in with account
- [ ] Can scan and see history when logged in
- [ ] History becomes empty when logged out
- [ ] Can log out successfully

---

## 📞 Need Help?

**If something doesn't work:**
1. Double-check all 6 values are copied correctly (no extra spaces)
2. Make sure Email/Password auth is ENABLED in Firebase
3. Reload the extension one more time
4. Close and reopen the extension popup
5. Check browser console for errors (F12 → Console tab)

**Common mistakes:**
- ❌ Forgetting to enable Email/Password auth
- ❌ Not replacing all `YOUR_*` values
- ❌ Extra spaces or typos in the config
- ❌ Not reloading the extension after changes
- ❌ Using a password shorter than 6 characters

---

## 🎉 You're All Set!

Your TermAlert extension now has:
- ✅ User authentication
- ✅ Secure login/signup
- ✅ History that saves automatically
- ✅ Data only stored when logged in

**Happy scanning! 🚀**
