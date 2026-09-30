# GuardianBox: End-to-End Encrypted (Zero-Knowledge) Ephemeral File Sharing

## Executive Summary & Threat Model
**GuardianBox** is an end-to-end encrypted (E2EE) file exchange platform engineered under a strict **Zero-Knowledge Architecture**. The server functions purely as a "blind" ciphertext broker. 

### Core Security Invariants
1. **Zero-Knowledge Guarantee**: The server never receives, logs, or stores raw file contents, filenames, or cryptographic keys.
2. **Confidentiality & Authenticity**: All data is encrypted via **AES-GCM (256-bit)** using the browser's native **Web Crypto API**. The built-in 128-bit authentication tag guarantees tamper detection.
3. **Client-Side Key Anchoring**: Decryption keys are embedded strictly in the URL fragment (`#<key>`). By RFC 3986, fragments are never transmitted to the server in HTTP request headers.
4. **Metadata Privacy**: Original filenames and MIME types are encrypted alongside the payload—the server only sees anonymous file IDs and ciphertext blobs.
5. **Enforced Ephemerality**: Automated deletion occurs upon reaching download caps (*Burn After Reading*) or time-to-live expiration (*TTL Cron*).

---

## Technical Architecture & Cryptographic Workflow

```
+----------------------------------------------------------------------------------------------------+
|                                         SENDER BROWSER                                             |
|                                                                                                    |
|  [ Original File ] + [ Metadata (Name/Type) ]                                                      |
|           |                                                                                        |
|           v                                                                                        |
|  [ Web Crypto API: crypto.subtle.generateKey('AES-GCM', 256) ] ---> [ 256-bit Secret Key ]        |
|  [ crypto.getRandomValues(12 bytes) ]                          ---> [ 96-bit Random IV ]          |
|           |                                                                                        |
|           v                                                                                        |
|  [ AES-GCM Encrypt ] =======================================> [ Ciphertext Blob ]                  |
|                                                                     |                              |
+---------------------------------------------------------------------|------------------------------+
                                                                      | POST /api/upload
                                                                      | (Ciphertext + IV + TTL/Max)
                                                                      | (NO KEY EVER SENT!)
                                                                      v
                                                    +----------------------------------+
                                                    |     GUARDIANBOX BACKEND API      |
                                                    |  - Blind Express Server          |
                                                    |  - Writes Blob to S3 / Storage   |
                                                    |  - Writes Record to SQLite DB    |
                                                    +----------------------------------+
                                                                      |
+---------------------------------------------------------------------|------------------------------+
|                                        RECIPIENT BROWSER            |                              |
|                                                                     v                              |
|  Opens URL: https://guardianbox.app/file/:id#key=<secret_key>       |                              |
|                                                                     |                              |
|  1. Extract Key from `window.location.hash` (Kept in Browser Memory)|                              |
|  2. GET /api/files/:id/download (Receives Ciphertext + IV) <--------+                              |
|  3. [ Web Crypto API: AES-GCM Decrypt(Ciphertext, Key, IV) ]                                      |
|  4. Integrity Verified via GCM Auth Tag                                                            |
|  5. Reconstruct Original File Blob & Trigger Browser Download                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## Detailed Cryptographic Specification

| Cryptographic Primitive | Standard / Parameter | Purpose |
| :--- | :--- | :--- |
| **Cipher Algorithm** | AES-GCM (Galois/Counter Mode) | Symmetric encryption with authenticated integrity checking |
| **Key Size** | 256 bits (`AES-256-GCM`) | Military-grade resistance against brute-force attacks |
| **Initialization Vector (IV)** | 96 bits (12 bytes) unique per file | Uniqueness prevents replay and cipher-reuse attacks |
| **Key Generation** | `crypto.subtle.generateKey` | Cryptographically secure pseudo-random number generator (CSPRNG) |
| **Key Transport** | URL Hash Fragment (`#key=<base64url>`) | Browser-local anchor; never sent to backend in HTTP requests |
| **Metadata Protection** | Inner JSON Envelope `Payload: { name, type, size, data }` | Hides filenames and MIME types from server logs |
| **Optional Passphrase Layer** | PBKDF2 (100,000 iterations, SHA-256) + 16-byte Salt | For sender-specified secondary passwords |

---

## Project Structure & Technology Stack

```
guardianbox/
├── package.json                    # Workspace orchestration
├── server/                         # Node.js + Express backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # Server entry point & graceful shutdown
│   │   ├── config.ts               # Env variables (Port, Storage type, AWS credentials)
│   │   ├── db/
│   │   │   ├── database.ts         # SQLite schema & query helpers
│   │   │   └── migrations.ts       # Database initial tables
│   │   ├── storage/
│   │   │   ├── storage.interface.ts# Common storage contract
│   │   │   ├── s3.storage.ts       # AWS S3 / MinIO client implementation
│   │   │   └── local.storage.ts    # Robust local disk storage fallback (zero-setup testing)
│   │   ├── routes/
│   │   │   └── file.routes.ts      # Upload, download, metadata check, deletion routes
│   │   ├── services/
│   │   │   ├── file.service.ts     # Business logic for burn-after-reading & atomic locks
│   │   │   └── cleanup.service.ts  # Cron worker for time-based automatic file purging
│   │   └── middlewares/
│   │       ├── rateLimit.ts        # Rate limiting against abuse & DoS
│   │       └── errorHandler.ts     # Safe error handler avoiding information leakage
│   └── tests/
│       └── file.test.ts            # Integration tests
└── client/                         # Modern React + Vite frontend
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── styles/
    │   │   └── index.css           # Premium Cyber-Dark Glassmorphic design system
    │   ├── crypto/
    │   │   ├── aes.ts              # Web Crypto API AES-GCM encrypt/decrypt implementations
    │   │   ├── keyUtils.ts         # Base64url encoding/decoding, key generation
    │   │   └── hashParser.ts       # URL hash fragment safe parser
    │   ├── components/
    │   │   ├── Header.tsx          # Status indicators (Zero-Knowledge badge, Security audits)
    │   │   ├── Dropzone.tsx        # File selection with drag-and-drop & metadata inspection
    │   │   ├── CryptoVisualizer.tsx# Visual representation of key generation, IV & entropy
    │   │   ├── EphemeralOptions.tsx# Burn-after-reading count & TTL timer picker
    │   │   ├── ShareModal.tsx      # Secure URL display with one-click copy and QR code
    │   │   └── DecryptView.tsx     # Recipient decrypt interface with live verification feedback
    │   └── services/
    │       └── api.ts              # API client for payload upload and download
```

---

## Phased Implementation Plan

### Phase 1: Cryptography Engine (Client-Side)
- Implement `client/src/crypto/aes.ts`:
  - `generateFileKey()`: Generates raw 256-bit CryptoKey using Web Crypto API.
  - `encryptFile(file: File, key: CryptoKey)`:
    - Generates 12-byte random IV.
    - Serializes file buffer with encrypted header (preserving original filename and MIME type).
    - Returns `{ ciphertext: ArrayBuffer, iv: Uint8Array }`.
  - `decryptFile(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array)`:
    - Decrypts ciphertext with AES-GCM and verifies authenticity tag.
    - Reconstitutes original `Blob` with name and type.
- Implement URL hash serialization (`#key=<rawBase64Url>`).

### Phase 2: Blind Backend & Ephemeral Storage Engine
- Set up Express server with TypeScript and SQLite (`better-sqlite3` or Prisma/sqlite).
- Table schema `files`:
  - `id`: UUID (Primary Key)
  - `storage_key`: S3 object key or local path
  - `iv`: Base64 encoded 12-byte IV
  - `salt`: Optional PBKDF2 salt
  - `size_bytes`: Ciphertext size in bytes
  - `max_downloads`: Maximum allowed downloads before burning (e.g. 1, 3, 5, or null)
  - `download_count`: Current successful downloads
  - `expires_at`: Timestamp (Unix ms / ISO)
  - `created_at`: Creation timestamp
- Storage Provider:
  - Multi-tier support: AWS S3 / MinIO via `@aws-sdk/client-s3` + automatic local storage fallback for immediate out-of-the-box local operation without external dependencies.
- Zero-Knowledge Upload Route (`POST /api/files/upload`):
  - Accepts multipart stream or raw binary payload with IV, TTL, and max downloads.
  - Generates secure random ID and commits ciphertext to storage.
  - **Zero Key check**: Validates that no key or plaintext parameters are ever sent to backend.

### Phase 3: Ephemeral Storage & Disposable Link Lifecycles
- Atomic Burn-After-Reading (`GET /api/files/:id/download`):
  - Uses an atomic SQLite transaction: increments `download_count`.
  - If `download_count >= max_downloads`: streams ciphertext to client, then immediately deletes the file from storage and purges the database entry.
- Background Cleanup Worker (`node-cron` or periodic timer):
  - Runs periodically to execute `DELETE FROM files WHERE expires_at <= CURRENT_TIMESTAMP`.
  - Purges orphaned ciphertext objects from storage bucket.

### Phase 4: Recipient Decrypt & Download Flow
- Recipient visits `http://localhost:5173/file/:id#key=<secretKey>`.
- Client parses URL hash locally (zero transmission to server).
- Checks link status via `GET /api/files/:id/meta`:
  - Returns file size, expiry timestamp, downloads remaining (or 404 / 410 Gone if expired or burned).
- Fetches ciphertext and IV from backend.
- Decrypts in browser memory and generates an ephemeral `URL.createObjectURL(blob)` for instant download.
- Automatically revokes the Object URL to free client memory.

### Phase 5: World-Class Cyber Security UI & UX
- Modern, dark-mode, glassmorphic interface inspired by military cyber terminals and privacy tools.
- Real-time cryptographic metrics:
  - Entropy display, key digest visualization (SHA-256 fingerprint of the key), and encryption timing.
- One-click copy with masked key preview (`https://.../file/abc#••••••••`).
- Built-in QR code generator for secure cross-device transfer.
- Explicit zero-knowledge security notices explaining how the `#` hash fragment protects user privacy.

---

## Verification & Testing Strategy
1. **Cryptographic Validation**: Test vectors with sample files (images, PDFs, binaries) verifying byte-for-byte exactness upon decryption.
2. **Server Blindness Audit**: Network inspector and server logs verification confirming zero exposure of encryption keys, filenames, or plaintext.
3. **Burn-After-Reading Test**: Verifying immediate 404/410 Gone response on second download attempt.
4. **Expiration Test**: Verifying files with short TTL (e.g., 30s) are cleanly purged by cleanup worker.
5. **Tamper Resilience**: Modifying a single byte of ciphertext to verify AES-GCM authentication failure (`OperationError: The operation failed for an operation-specific reason`).
