# 🛡️ GuardianBox

> **End-to-End Encrypted (Zero-Knowledge) Ephemeral File Exchange Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: Zero-Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge-green.svg)](#core-security-invariants)
[![Web Crypto API](https://img.shields.io/badge/Crypto-Web_Crypto_API-orange.svg)](#detailed-cryptographic-specification)
[![Node.js Engine](https://img.shields.io/badge/Backend-Node.js_/_Express-brightgreen.svg)](#project-structure--technology-stack)

GuardianBox is a zero-knowledge, end-to-end encrypted (E2EE) file-sharing platform. Files are encrypted directly within the browser prior to upload, ensuring that the backend server acts purely as a "blind" ciphertext broker. Decryption keys are stored exclusively in the browser's URL fragment (`#`), rendering them completely invisible to server logs, proxy servers, and network intermediaries.

---

## 📋 Table of Contents
- [Core Security Invariants & Threat Model](#core-security-invariants--threat-model)
- [Technical Architecture & Workflow](#technical-architecture--workflow)
- [Detailed Cryptographic Specification](#detailed-cryptographic-specification)
- [Project Structure](#project-structure--technology-stack)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Installation & Execution](#installation--execution)
- [API Reference](#api-reference)
- [Verification & Testing Strategy](#verification--testing-strategy)
- [License](#license)

---

## 🔒 Core Security Invariants & Threat Model

GuardianBox operates under a strict threat model where the server host, cloud storage provider, and underlying network are assumed to be fully compromised or untrusted.

1. **Zero-Knowledge Guarantee**: Raw file contents, metadata (filenames, MIME types), and cryptographic keys are never sent to, stored on, or logged by the server.
2. **Confidentiality & Authenticity**: Every file payload is encrypted using **AES-256-GCM**. The 128-bit authentication tag guarantees instant detection of ciphertext tampering or truncation.
3. **Client-Side Key Anchoring**: Decryption keys are anchored exclusively in the URL fragment (`#<key>`). Per **RFC 3986**, URL hash fragments are handled purely client-side and are never transmitted to the server in HTTP request headers.
4. **Metadata Privacy**: File metadata (original name, extension, MIME type, size) is packed into an inner JSON payload prior to encryption. The server only receives anonymous unique file IDs and randomized ciphertext blobs.
5. **Enforced Ephemerality**: Files automatically purge based on strict parameters:
   - **Burn After Reading**: Instant atomic destruction upon reaching the download limit.
   - **TTL Purge**: Automatic background worker cleanup upon expiration.

---

## 📐 Technical Architecture & Workflow

```
+----------------------------------------------------------------------------------------------------+
|                                          SENDER BROWSER                                            |
|                                                                                                    |
|  [ Original File ] + [ Metadata (Name/Type) ]                                                      |
|          |                                                                                         |
|          v                                                                                         |
|  [ Web Crypto API: crypto.subtle.generateKey('AES-GCM', 256) ] ---> [ 256-bit Secret Key ]        |
|  [ crypto.getRandomValues(12 bytes) ]                           ---> [ 96-bit Random IV ]          |
|          |                                                                                         |
|          v                                                                                         |
|  [ AES-GCM Encrypt ] =======================================> [ Ciphertext Blob ]                  |
|                                                                      |                             |
+----------------------------------------------------------------------|-----------------------------+
                                                                       | POST /api/files/upload
                                                                       | (Ciphertext + IV + TTL/Max)
                                                                       | (NO KEY EVER SENT!)
                                                                       v
                                                    +----------------------------------+
                                                    |     GUARDIANBOX BACKEND API      |
                                                    |  - Blind Express Server          |
                                                    |  - Writes Blob to S3 / Local     |
                                                    |  - Writes Record to SQLite DB    |
                                                    +----------------------------------+
                                                                       |
+----------------------------------------------------------------------|-----------------------------+
|                                        RECIPIENT BROWSER             |                             |
|                                                                      v                             |
|  Opens URL: https://guardianbox.app/file/:id#key=<secret_key>        |                             |
|                                                                      |                             |
|  1. Extract Key from `window.location.hash` (Kept in Browser Memory) |                             |
|  2. GET /api/files/:id/download (Receives Ciphertext + IV) <---------+                             |
|  3. [ Web Crypto API: AES-GCM Decrypt(Ciphertext, Key, IV) ]                                       |
|  4. Integrity Verified via GCM Auth Tag                                                            |
|  5. Reconstruct Original File Blob & Trigger Browser Download                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## 🔐 Detailed Cryptographic Specification

| Cryptographic Primitive | Standard / Parameter | Purpose |
| :--- | :--- | :--- |
| **Cipher Algorithm** | AES-GCM (Galois/Counter Mode) | Authenticated symmetric encryption providing confidentiality and tamper prevention. |
| **Key Size** | 256 bits (`AES-256-GCM`) | High-grade key strength against brute-force attacks. |
| **Initialization Vector (IV)** | 96 bits (12 bytes) unique per file | Cryptographically secure random IV generated via `crypto.getRandomValues()` to prevent replay attacks. |
| **Key Generation** | `crypto.subtle.generateKey` | Uses browser CSPRNG for non-deterministic key generation. |
| **Key Transport** | URL Hash Fragment (`#key=<base64url>`) | Kept strictly client-side; never hits network layers or server access logs. |
| **Metadata Protection** | Inner JSON Payload | Encrypts filename, MIME type, and timestamp inside the ciphertext container. |
| **Passphrase Layer (Optional)** | PBKDF2 (100,000 iterations, SHA-256) + 16-byte Salt | Key stretching for custom passphrase protection. |

---

## 🛠️ Project Structure & Technology Stack

```
guardianbox/
├── package.json                    # Workspace orchestration
├── server/                         # Node.js + Express backend engine
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # App entrypoint & graceful teardown
│   │   ├── config.ts               # Environment configuration
│   │   ├── db/
│   │   │   ├── database.ts         # SQLite connection & query utilities
│   │   │   └── migrations.ts       # Database schema initialization
│   │   ├── storage/
│   │   │   ├── storage.interface.ts# Common storage contract
│   │   │   ├── s3.storage.ts       # AWS S3 / MinIO storage driver
│   │   │   └── local.storage.ts    # Fallback local disk storage driver
│   │   ├── routes/
│   │   │   └── file.routes.ts      # REST API route endpoints
│   │   ├── services/
│   │   │   ├── file.service.ts     # Ephemeral file handling & atomic burn locks
│   │   │   └── cleanup.service.ts  # Automatic background TTL cleanup cron
│   │   └── middlewares/
│   │       ├── rateLimit.ts        # Rate limiting middleware
│   │       └── errorHandler.ts     # Leak-proof error handling
│   └── tests/
│       └── file.test.ts            # Integration test suite
└── client/                         # React + Vite frontend application
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles/
        │   └── index.css           # Glassmorphic cyber-dark theme styles
        ├── crypto/
        │   ├── aes.ts              # Web Crypto API encryption/decryption routines
        │   ├── keyUtils.ts         # Base64url encoding/decoding & key gen helpers
        │   └── hashParser.ts       # Safe location.hash fragment parser
        ├── components/
        │   ├── Header.tsx          # Zero-Knowledge badges & status header
        │   ├── Dropzone.tsx        # Drag-and-drop file upload zone
        │   ├── CryptoVisualizer.tsx# Visual display of entropy & key hashes
        │   ├── EphemeralOptions.tsx# Configurable TTL & download count options
        │   ├── ShareModal.tsx      # Link display with auto-masking & QR code
        │   └── DecryptView.tsx     # Recipient download & decryption interface
        └── services/
            └── api.ts              # Fetch client wrapper for backend routes
```

---

## ✨ Features

- **Zero-Knowledge Web Crypto**: Powered natively by the browser's built-in `crypto.subtle` performance engine.
- **Burn-After-Reading**: Automatically deletes ciphertext from storage and database records instantly after the specified download count is met.
- **Time-to-Live Expiration**: Configurable lifetime limits (e.g., 5 minutes, 1 hour, 24 hours).
- **Storage Agnostic**: Supports local storage out-of-the-box for development, with built-in drivers for S3-compatible object storage (AWS S3, MinIO, Cloudflare R2).
- **Cyber-Dark UI**: Glassmorphic dashboard featuring real-time key fingerprint visualization, entropy gauges, and QR code generation.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **pnpm** / **npm** / **yarn**
- **SQLite3** (automatically handled via local driver)

### Environment Configuration

Create a `.env` file inside the `server/` directory:

```env
PORT=3000
NODE_ENV=development

# Storage Driver: 'local' or 's3'
STORAGE_DRIVER=local

# Local Storage Directory (Used if STORAGE_DRIVER=local)
LOCAL_STORAGE_PATH=./uploads

# AWS / S3 Configuration (Used if STORAGE_DRIVER=s3)
S3_BUCKET_NAME=guardianbox-files
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=                       # Optional for MinIO / Custom S3 endpoints
```

### Installation & Execution

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/guardianbox.git
   cd guardianbox
   ```

2. **Install dependencies for root, client, and server:**
   ```bash
   npm run install:all
   ```

3. **Start the development servers (Client + Server concurrently):**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3000`

---

## 📡 API Reference

### 1. Upload Encrypted Ciphertext
- **Endpoint**: `POST /api/files/upload`
- **Content-Type**: `multipart/form-data`
- **Body Parameters**:
  - `file`: Ciphertext Binary Blob
  - `iv`: Base64 encoded 12-byte IV string
  - `maxDownloads`: Integer (e.g., `1`, `3`, `5`, or `null`)
  - `ttlMinutes`: Integer (Expiration time in minutes)
- **Response**:
  ```json
  {
    "id": "e4b3c91a-7212-429a-8e2b-10a123f890ab",
    "expiresAt": "2026-10-01T20:00:00.000Z",
    "maxDownloads": 1
  }
  ```

### 2. Fetch File Metadata
- **Endpoint**: `GET /api/files/:id/meta`
- **Response**:
  ```json
  {
    "id": "e4b3c91a-7212-429a-8e2b-10a123f890ab",
    "sizeBytes": 1048576,
    "remainingDownloads": 1,
    "expiresAt": "2026-10-01T20:00:00.000Z"
  }
  ```

### 3. Download Ciphertext Blob
- **Endpoint**: `GET /api/files/:id/download`
- **Headers**: Returns `X-IV` header containing the Base64 IV.
- **Response**: Encrypted binary stream (`application/octet-stream`).
- *Note*: If `downloadCount >= maxDownloads`, the file is purged from disk/S3 and DB atomically during or immediately following this operation.

---

## 🧪 Verification & Testing Strategy

GuardianBox includes automated and manual validation checks to guarantee security invariants:

1. **Cryptographic Roundtrip Test**: Verifies byte-level integrity across various file sizes and binary formats (images, executables, PDFs).
2. **Server Blindness Audit**: Network tab inspection confirms no decryption key fragment (`#key=...`) is ever transmitted to backend routes.
3. **Atomic Destruction Verification**: Confirms that downloading a file configured with `maxDownloads = 1` yields a `404 Not Found` or `410 Gone` HTTP status on all subsequent attempts.
4. **Tamper Test**: Modifying even a single bit of the stored ciphertext blob triggers an immediate `OperationError` exception inside the client's Web Crypto API during decryption.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.