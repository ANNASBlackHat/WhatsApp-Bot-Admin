# Deployment & Production Setup Guide

This document provides step-by-step instructions for deploying the **WhatsApp Bot Admin Web App** to **Vercel** per PRD Section 9.

---

## 1. Prerequisites

Before deploying, ensure you have:
1. Access to the **Firebase Console** for your project.
2. A **Vercel** account (connected to GitHub/GitLab).
3. The WhatsApp Bot Account ID (`WA_ID`) used in Firestore document paths (`wa_bot/{waId}`).

---

## 2. Environment Variables Configuration

Configure the following environment variables in Vercel under **Project Settings → Environment Variables**:

| Variable Name | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | **Yes** | Firebase Web SDK API Key | `AIzaSyB...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | **Yes** | Firebase Auth Domain | `my-app.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | **Yes** | Firebase Project ID | `my-project-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | **Yes** | Firebase Storage Bucket | `my-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | **Yes** | Firebase Messaging Sender ID | `1234567890` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | **Yes** | Firebase Web App ID | `1:1234567890:web:...` |
| `NEXT_PUBLIC_WA_ID` | **Yes** | WhatsApp Account ID in Firestore (`wa_bot/{waId}`) | `628123456789` |

---

## 3. Deploying to Vercel

### Option A: Deploy via Vercel Web Dashboard (Recommended)

1. Push your repository to GitHub or GitLab.
2. Import the project in Vercel:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. Add all Environment Variables listed above under **Environment Variables**.
4. Click **Deploy**.

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 4. Firebase Authentication & Firestore Setup

### 4.1 Firebase Authentication
Ensure **Email/Password** provider is enabled in **Firebase Console → Authentication → Sign-in method**.

### 4.2 Bootstrap Admin User Access Control
To grant an account admin write permissions, create the admin user document in Firestore:
- **Collection**: `app_config`
- **Document ID**: `admin_users`
- **Fields**:
  - `uids` (array of strings): `["<YOUR_FIREBASE_USER_UID>"]`

### 4.3 Firestore Security Rules Deployment
Deploy the security rules from `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

---

## 5. Build & Test Commands

```bash
# Run ESLint check
npm run lint

# Run Core Business Logic Unit Tests
npm run test

# Run Next.js Production Build
npm run build
```
