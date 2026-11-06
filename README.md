# BarterShelf

BarterShelf is an Expo Router mobile app for local buy, sell, swap, and rental listings, backed by an Express API and MongoDB. The app targets iOS and Android; it is not a web app.

## Start the backend

Requirements: Node.js 20+ and a MongoDB database (Atlas or local). Configure Cloudinary for hosted listing photos; in development, photos are stored locally under `backend/uploads` if Cloudinary is not configured.

1. In `backend`, copy `.env.example` to `.env`.
2. Set `MONGODB_URI` and a private `JWT_SECRET` of at least 32 characters. Set `CLOUDINARY_URL` to use Cloudinary for photo uploads.
3. Install and start the API:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

The API listens on port 4000 and exposes `/health` for a connection check. Vendor accounts are not marked verified by signup; an administrator must verify them in the database using a separate trusted admin process.

## Start the mobile app in Expo Go

1. From the project root, install dependencies with `npm install`.
2. Create a root `.env` file with your computer's LAN IPv4 address, for example:

   ```dotenv
   EXPO_PUBLIC_API_URL=http://192.168.1.25:4000/api
   ```

   Find the address with `ipconfig` on Windows. Your phone and computer must be on the same Wi-Fi network, and Windows Firewall must allow Node.js on private networks. `localhost` only works in a simulator running on the same computer.
3. Start Expo with `npx.cmd expo start --lan` in PowerShell (or `npm.cmd run start -- --lan` if PowerShell blocks `npx.ps1`). Scan the QR code in Expo Go.

For iOS, allow BarterShelf to access the local network when prompted. For the iOS Simulator, set a simulated location from **Features > Location** before browsing or publishing. Choose a preset or enter coordinates for the neighborhood you want to test; a simulator may not have a current location fix by default. Development photo uploads are stored on the backend machine; configure `CLOUDINARY_URL` for hosted photos.

## Run on Windows with Android

Requirements: Node.js 20+, Android Studio with an Android emulator (or an Android phone with Expo Go), and a reachable MongoDB database.

1. In PowerShell, open the project root and install app dependencies: `npm.cmd install`.
2. Configure and start the backend in a second terminal. Copy `backend/.env.example` to `backend/.env`, set `MONGODB_URI` and a private `JWT_SECRET` of at least 32 characters, then run `cd backend`, `npm.cmd install`, and `npm.cmd start`.
3. Set `EXPO_PUBLIC_API_URL` in the root `.env` to `http://<computer-LAN-IP>:4000/api` for a physical phone, or `http://10.0.2.2:4000/api` for the standard Android emulator. Allow Node.js through Windows Firewall on private networks.
4. For Expo Go, run `npm.cmd start -- --lan` from the project root and scan the QR code. For an Android emulator with the Android SDK installed, run `npm.cmd run android`.

The phone/emulator and computer must be able to reach the API host. A deployed HTTPS API URL can be used instead of the local address.

## Implemented flows

- Email/password signup and sign-in with buyer, individual seller, or vendor roles.
- GPS permission and neighborhood storage, adjustable 1–10 km discovery radius, text/category search, condition and transaction filters.
- Multi-item draft batching, review, up to four camera/gallery photos per item, Cloudinary or local-development photo upload, and bulk publish.
- Nearby seller bundle matching, listing detail, sale/rental pickup transactions, sales summary, and text/cash/trade chat offers.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`
- `POST /api/listings` accepts one listing or an array; `GET /api/listings/nearby`; `GET /api/listings/mine`
- `POST /api/bundle-match`
- `POST /api/uploads/images` (Cloudinary or local development storage)
- `POST /api/transactions`, `GET /api/transactions/sales`, `PATCH /api/transactions/:id/complete`
- `GET/POST /api/chats`, `GET/POST /api/chats/:id/messages`

## Production deployment notes

The source includes input validation, hashed passwords, signed bearer sessions, request rate limiting, security headers, bounded upload sizes, geospatial indexes, and error responses. A real launch still needs production hosting and secrets, restrictive CORS, verified MongoDB/Cloudinary configuration, an admin workflow for vendor verification/moderation, backup/monitoring, privacy and retention policies, and device testing. Do not expose development secrets or use the local API URL in a store build.
