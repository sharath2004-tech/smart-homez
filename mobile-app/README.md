# Healthy Homez — Mobile App (Capacitor)

Capacitor shell that wraps the existing Vite+React web app for Android and iOS.

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| Java JDK | 17 or 21 | https://adoptium.net |
| Android Studio | Latest | https://developer.android.com/studio |
| Xcode (iOS) | ≥ 15 | macOS only |

---

## First-time Setup

### 1. Install mobile-app dependencies
```bash
cd mobile-app
npm install
```

### 2. Set up mobile env variables
```bash
# From project root (pure-app-weave-main/)
cp .env.mobile.example .env.mobile
# Edit .env.mobile — replace 192.168.1.xxx with your machine's LAN IP
```

### 3. Build the web app
```bash
# From project root
npm run build:mobile
```

### 4. Add native platforms (first time only)
```bash
cd mobile-app
npx cap add android
npx cap add ios        # macOS only
```

### 5. Sync web build to native
```bash
npx cap sync
```

---

## Daily Development Workflow

### Option A — From project root
```bash
npm run mobile:android    # build + sync + open Android Studio
npm run mobile:ios        # build + sync + open Xcode (macOS)
```

### Option B — Manual steps
```bash
# 1. Build web app
npm run build:mobile

# 2. Sync to native
cd mobile-app && npx cap sync

# 3. Open IDE
npx cap open android
npx cap open ios
```

### Live Reload on Device (Android)
```bash
cd mobile-app
npm run live
# OR from project root with dev server running:
# Edit capacitor.config.ts → server.url = 'http://<your-ip>:8080'
# Then: npx cap sync android && npx cap run android
```

---

## Project Structure

```
mobile-app/
├── capacitor.config.ts   ← App config, plugins, permissions
├── package.json          ← Capacitor packages
├── android/              ← Android Studio project (generated)
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       └── res/           ← icons, splash screens
└── ios/                  ← Xcode project (generated, macOS only)
    └── App/
        └── Info.plist
```

---

## Backend API

The mobile app uses the **same backend** as the web app.

| Environment | VITE_API_URL |
|-------------|-------------|
| Local dev (emulator) | `http://<your-LAN-ip>:5000/api` |
| Production | Your deployed backend URL |

> ⚠️ Never use `localhost` in `.env.mobile` — Android emulators use `10.0.2.2` for the host machine, and real devices use the LAN IP.

---

## Android — Permissions

These are added automatically by Capacitor plugins in `AndroidManifest.xml`:
- `INTERNET`
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` (Geolocation)
- `CAMERA` (Camera plugin)
- `POST_NOTIFICATIONS` (Push Notifications)
- `VIBRATE` (Haptics)

---

## iOS — Info.plist Keys

After `npx cap add ios`, add these to `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Used for QR code scanning and profile photo upload</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to show services available near your location</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Used to show services available near your location</string>
```

---

## Building for Release

### Android APK / AAB
1. Open Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle / APK
3. Follow signing wizard

### iOS IPA
1. Open Xcode: `npx cap open ios`
2. Product → Archive
3. Upload to App Store Connect or export for AdHoc

---

## Push Notifications (Future)

To enable FCM push notifications:
1. Create a Firebase project at https://console.firebase.google.com
2. Download `google-services.json` → place in `android/app/`
3. Download `GoogleService-Info.plist` → place in `ios/App/App/`
4. Follow `@capacitor/push-notifications` docs
