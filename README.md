# BarterShelf

BarterShelf is an Expo Router mobile app for local buy, sell, swap, and rental listings, backed by an Express API and MongoDB. The app targets iOS and Android; it is not a web app.

## Start the backend

Requirements: Node.js 20+, a MongoDB database (Atlas or local), and a Cloudinary account for listing photos.

1. In `backend`, copy `.env.example` to `.env`.
2. Set `MONGODB_URI` and a private `JWT_SECRET` of at least 32 characters. Set `CLOUDINARY_URL` to enable photo uploads.
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

## Implemented flows

- Email/password signup and sign-in with buyer, individual seller, or vendor roles.
- GPS permission and neighborhood storage, adjustable 1–10 km discovery radius, text/category search, condition and transaction filters.
- Multi-item draft batching, review, up to four camera/gallery photos per item, Cloudinary upload, and bulk publish.
- Nearby seller bundle matching, listing detail, sale/rental pickup transactions, sales summary, and text/cash/trade chat offers.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`
- `POST /api/listings` accepts one listing or an array; `GET /api/listings/nearby`; `GET /api/listings/mine`
- `POST /api/bundle-match`
- `POST /api/uploads/images` (Cloudinary)
- `POST /api/transactions`, `GET /api/transactions/sales`, `PATCH /api/transactions/:id/complete`
- `GET/POST /api/chats`, `GET/POST /api/chats/:id/messages`

## Production deployment notes

The source includes input validation, hashed passwords, signed bearer sessions, request rate limiting, security headers, bounded upload sizes, geospatial indexes, and error responses. A real launch still needs production hosting and secrets, restrictive CORS, verified MongoDB/Cloudinary configuration, an admin workflow for vendor verification/moderation, backup/monitoring, privacy and retention policies, and device testing. Do not expose development secrets or use the local API URL in a store build.
