# ParkGrid — Smart Parking Management & Marketplace (India)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [P] ParkGrid   ·   Live Bay Telemetry   ·   QR Gate Passes   ·   INR (₹)   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Driver Marketplace   │   My QR Passes   │   Vendor Console   │   Admin      │
│  • GPS & City Search  │   • Active Token │   • Add Lot & Pin  │   • Approvals│
│  • Street View Cards  │   • Live Timer   │   • 90/10 UPI Split│   • Users    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**ParkGrid** is a full-featured, India-localized (`INR` / `₹`) Smart Parking Marketplace & Bay Management web application built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Firebase Auth & Cloud Firestore**, and **Google Maps Platform**.

This guide walks you step-by-step through running the downloaded project locally, plugging in your own credentials, granting yourself Super Admin access, and deploying it for free.

---

## 1. Quick Start (After Downloading ZIP)

### Prerequisites
- **Node.js** `v18+` (recommended `v20` or `v22`)
- **npm** `v9+` (or `bun` / `pnpm`)

### Install & Run Locally
Open your terminal in the extracted project folder and run:

```bash
# 1. Install all dependencies
npm install

# 2. Create your local environment file from the template
cp .env.example .env

# 3. Start the local Vite development server (http://localhost:3000)
npm run dev
```

---

## 2. Where All Credentials Live (Overview)

When running locally or deploying outside the cloud preview, ParkGrid uses **two** configuration files in the project root:

| File | Purpose | Required For |
| :--- | :--- | :--- |
| **`.env`** | Stores `VITE_GOOGLE_MAPS_API_KEY` | Interactive 3D/Vector Google Maps, Live Nearby Parking Search, Place Photos, Street View Previews, and Turn-by-Turn Route Directions |
| **`firebase-applet-config.json`** | Stores Firebase Project & Firestore Database IDs | Google Sign-In (`signInWithPopup`), Live Parking Slots, Real-Time Bookings, User Profiles, and Super Admin Controls |

---

## 3. Step-by-Step: Adding Your Google Maps API Key (`.env`)

ParkGrid reads your Google Maps key automatically via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` (in `src/components/maps/PlacesProvider.tsx`).

### Step 3.1 — Enable Required Google Maps APIs
In your [Google Cloud Console -> APIs & Services -> Library](https://console.cloud.google.com/apis/library), enable these **4 APIs** on your project:
1. **Maps JavaScript API** *(renders interactive dark/light maps & markers)*
2. **Places API (New)** *(powers live parking discovery, city/address autocomplete & place photos)*
3. **Routes API** *(computes driving/walking routes, distance & ETA inside the Directions modal)*
4. **Street View Static API** *(provides real street-level camera fallbacks for parking cards)*

### Step 3.2 — Create & Add Your Key to `.env`
1. Go to [Google Cloud Console -> Credentials](https://console.cloud.google.com/apis/credentials) and click **+ Create Credentials -> API key**.
2. Open the `.env` file in the root of your downloaded project and paste your key:

```env
# .env (in project root)
VITE_GOOGLE_MAPS_API_KEY="AIzaSyYourActualGoogleMapsKeyHere"
```

3. Restart `npm run dev` so Vite picks up the new `.env` variable.

> **Tip (API Key Restrictions):** If you restrict your API key by HTTP referrers in Google Cloud Console, make sure to allow:
> - `http://localhost:3000/*`
> - `http://127.0.0.1:3000/*`
> - Your production domain (e.g. `https://your-app.web.app/*` or `https://your-app.vercel.app/*`)

---

## 4. Step-by-Step: Configuring Firebase (`firebase-applet-config.json`)

The downloaded project is already pre-configured with your existing Firebase project (`gen-lang-client-0953609265`). You can **keep using the existing config**, or **swap in a brand-new Firebase project**.

### Option A: Keep Using the Included Firebase Project (Fastest)
If you keep the existing `firebase-applet-config.json`, you only need to authorize `localhost` (and any custom domain you deploy to) for Google Sign-In:

1. Open [Firebase Console](https://console.firebase.google.com/) and select project **`gen-lang-client-0953609265`**.
2. Go to **Authentication -> Settings -> Authorized domains**.
3. Ensure **`localhost`** is in the list (for local development) and add your deployed domain (e.g., `your-site.vercel.app` or `your-site.netlify.app`).

### Option B: Connect Your Own New Firebase Project
If you want to use a completely separate Firebase account/project:

1. Go to [Firebase Console](https://console.firebase.google.com/) and click **Create a project**.
2. **Register a Web App (`</>`)**:
   - In Project Overview, click the Web icon (`</>`), register an app nickname (e.g., `ParkGrid`), and copy the `firebaseConfig` values.
3. **Enable Google Sign-In**:
   - Go to **Build -> Authentication -> Sign-in method**.
   - Click **Google**, toggle **Enable**, select your support email, and click **Save**.
4. **Create a Cloud Firestore Database**:
   - Go to **Build -> Firestore Database -> Create database**.
   - Choose your preferred location (e.g., `asia-south1` Mumbai) and start in **Production mode**.
   - Note your Database ID:
     - If you use the default database, set `"firestoreDatabaseId": "(default)"`.
     - If you use a named database, put its exact name in `"firestoreDatabaseId"`.
5. **Update `firebase-applet-config.json`** in the project root:

```json
{
  "projectId": "your-firebase-project-id",
  "appId": "1:1234567890:web:abcdef123456",
  "apiKey": "AIzaSyYourFirebaseWebApiKey",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "1234567890",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
}
```

6. **Publish Security Rules (`firestore.rules`)**:
   - Open your project's **`firestore.rules`** file, copy its entire contents, and paste it into **Firebase Console -> Firestore Database -> Rules**, then click **Publish**.

---

## 5. How to Grant Yourself Super Admin Access (`admin: true`)

For security, no user can make themselves an Admin from the website UI (`firestore.rules` strictly blocks self-escalation). Admin privileges are controlled exclusively from **Firebase Console**:

1. Run the app and **Sign In with Google** once so your profile document is created in Firestore.
2. Open [Firebase Console -> Firestore Database -> Data](https://console.firebase.google.com/).
3. Open the **`users`** collection and click on the document matching your **User UID** (or find it by your email address).
4. Click **+ Add field**:
   - **Field name:** `admin`
   - **Field type:** `boolean`
   - **Field value:** `true`
5. Click **Update**.

Because ParkGrid listens to your profile document in real time (`onSnapshot`), the **Admin Center** link will appear immediately in your top-right Profile menu and Profile page—no page reload needed.

---

## 6. Deploying for Free (Without Cloud Run Billing)

Because ParkGrid compiles into a static Single-Page Application (`dist/`), you can deploy it for **free** on **Firebase Hosting**, **Vercel**, or **Netlify**.

### Build Production Bundle Locally
```bash
npm run build
```
This outputs optimized static assets into the `dist/` directory.

### Option 1: Deploy to Vercel / Netlify
1. Push your project to a private or public GitHub repository.
2. Import the repository into **Vercel** or **Netlify**:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Environment Variable:** Add `VITE_GOOGLE_MAPS_API_KEY` with your Google Maps key.
3. After deployment finishes, copy your new `.vercel.app` or `.netlify.app` domain and add it to **Firebase Console -> Authentication -> Settings -> Authorized domains** so Google Sign-In works on your live URL.

### Option 2: Deploy to Firebase Hosting (Free Spark Tier)
```bash
# Install Firebase CLI globally if needed
npm install -g firebase-tools

# Sign in to Firebase
firebase login

# Initialize hosting (select your project, set public directory to "dist", configure as single-page app "Yes")
firebase init hosting

# Build and deploy
npm run build
firebase deploy --only hosting
```

---

## 7. Project Structure Reference

```text
├── .env.example                  # Template for VITE_GOOGLE_MAPS_API_KEY
├── firebase-applet-config.json   # Firebase Auth & Firestore connection config
├── firestore.rules               # Hardened Zero-Trust Firestore security rules
├── firebase-blueprint.json       # Entity schemas & collection blueprint
├── src/
│   ├── App.tsx                   # Multi-page router, live Firestore sync & auth state
│   ├── lib/
│   │   ├── firebase.ts           # Firebase SDK init, CRUD & real-time subscriptions
│   │   └── utils.ts              # INR currency formatter, bay generator & Haversine math
│   ├── components/
│   │   ├── driver/               # Driver Marketplace, Booking Modal, QR Passes & Directions
│   │   ├── vendor/               # Vendor Partner Console, Lot Publisher & 90/10 UPI Ledger
│   │   ├── admin/                # Super Admin Approval Queue, User & Facility Governance
│   │   ├── profile/              # Creative Member Profile Page & Digital Access Pass
│   │   ├── maps/                 # Google Maps PlacesProvider, Rate Limiter & Map View
│   │   └── ui/                   # VariableText, WordmarkFooter, WaveMesh & ParkingThumbnail
```
