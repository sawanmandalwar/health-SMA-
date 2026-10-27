# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Backend + device testing (Health-Saathi)

1. **Start the backend** (Node/Express + MongoDB Atlas, lives in `Backend/`):

   ```bash
   cd Backend
   npm install          # first time only
   copy .env.example .env   # then edit Backend/.env with your real values
   npm run dev          # or: node server.js
   ```

   Secrets live only in `Backend/.env` (git-ignored). See `Backend/.env.example` for the required keys.

2. **Point the app at the backend**: set `EXPO_PUBLIC_API_URL` in the root `.env`
   and restart Metro with a cleared cache:

   ```bash
   # .env
   EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:5000
   ```

   ```bash
   npx expo start --clear
   ```

   Use the PC's LAN IP (run `ipconfig` to find it). Allow Node.js through the
   Windows Firewall for port 5000, or the phone — even on the same Wi-Fi — will
   fail to connect. A secure (`https://`) tunnel URL you control also works.
   The API URL is never hard-coded in the app; without `.env` the app fails
   loudly with a config error instead of silently hitting a stale URL.

3. **Build to your Android device** (OCR + medicine reminders need native
   modules, so Expo Go is not enough):

   ```bash
   npx expo run:android
   ```

   The dev build includes the prescription OCR module
   (`@zhanziyang/expo-text-extractor`, Android only) and clear-HTTP
   (`usesCleartextTraffic`) so the LAN backend URL works over plain `http://`.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
