# Park My Car – build and publish on Google Play

The app is a web app (`docs/`) wrapped as an Android app with Capacitor.

## 1. One-time setup (on your PC)
1. Install Node.js (LTS) and Android Studio.
2. In this folder run:
   ```
   npm install
   npx cap add android
   npm run assets        # makes launcher icon + splash from /assets
   npx cap sync android
   ```
3. Change `appId` in `capacitor.config.json` to your own (e.g. `com.yourname.parkmycar`) BEFORE `cap add android`. It can never change after publishing.

## 2. Allow location and camera
Open `android/app/src/main/AndroidManifest.xml` and add these inside `<manifest>`, next to the INTERNET permission:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```
Then run `npx cap sync android`.

## 3. Test on a phone
`npx cap open android` opens Android Studio. Connect your phone (USB debugging on) and press Run.
Check: Park here → save → walk away → Find my car. Test in a real basement too.

## 4. Build for Play Store
In Android Studio: Build > Generate Signed App Bundle / APK > Android App Bundle (.aab).
Create a keystore and KEEP IT SAFE (back it up). You need it for every update.
Before release, set `versionCode` / `versionName` in `android/app/build.gradle`.

## 5. Play Console
1. Create a developer account (one-time US$25; new personal accounts must run a closed test with 12+ testers for 14 days before production).
2. Create app, upload the .aab, add screenshots (phone), short and full description, app icon 512x512 (use `assets/icon-only.png` scaled).
3. Privacy policy: host `PRIVACY_POLICY.md` as a web page (GitHub Pages / Google Sites) and paste the URL. Put your email in it.
4. Data safety form: location and photos are processed on-device only and not collected or shared.
5. Content rating questionnaire: choose Utility.

## Ideas for version 2
- Auto-save when the phone disconnects from the car's Bluetooth (needs a native plugin).
- Floor from phone barometer, multiple vehicles, reminders for paid parking time, dark map view.
