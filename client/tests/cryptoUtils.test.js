import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKey,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  getKeyFingerprint,
  bufferToBase64Url,
  base64UrlToBuffer,
} from '../src/cryptoUtils.js';

describe('Crypto Module: cryptoUtils.js Web Crypto API Verification', () => {

  it('verifies that encrypt(data, key) followed by decrypt(ciphertext, key) returns the original text data', async () => {
    const originalText = 'Top Secret: The server is completely blind to this plaintext!';
    
    // 1. Generate 256-bit AES-GCM symmetric key
    const key = await generateKey();
    assert.ok(key, 'Key should be successfully generated');
    assert.equal(key.algorithm.name, 'AES-GCM');

    // 2. Encrypt original data
    const encrypted = await encrypt(originalText, key);
    assert.ok(encrypted.ciphertext, 'Ciphertext should be produced');
    assert.ok(encrypted.iv, '12-byte IV should be produced');
    assert.equal(encrypted.iv.byteLength, 12, 'IV must be exactly 96 bits (12 bytes)');

    // 3. Decrypt ciphertext using the container object and original key
    const decrypted = await decrypt(encrypted, key);

    // 4. Assert byte-for-byte fidelity
    assert.equal(decrypted, originalText, 'Decrypted text must match original plaintext exactly');
  });

  it('verifies that encrypt(data, key) followed by decrypt(ciphertext, key) returns original binary data (Uint8Array)', async () => {
    // Generate sample binary buffer with arbitrary bytes
    const originalBinary = new Uint8Array([0x00, 0x01, 0x42, 0x99, 0xDE, 0xAD, 0xBE, 0xEF, 0xFF]);
    const key = await generateKey();

    // Encrypt binary data
    const encrypted = await encrypt(originalBinary, key);

    // Decrypt using packed buffer form [12 bytes IV + ciphertext]
    const decrypted = await decrypt(encrypted.packed, key);

    // Assert binary matches
    assert.deepEqual(decrypted, originalBinary, 'Decrypted Uint8Array must match original bytes exactly');
  });

  it('verifies decrypt with separate (ciphertext, key, iv) arguments returns the original data', async () => {
    const originalSecret = 'Confidential investigative report #9482';
    const key = await generateKey();

    const { ciphertext, iv } = await encrypt(originalSecret, key);

    // Call decrypt with explicit (ciphertext, key, iv) signature
    const decrypted = await decrypt(ciphertext, key, iv);

    assert.equal(decrypted, originalSecret, 'Explicit parameter decrypt must match original secret');
  });

  it('verifies string-exported key roundtrip (URL fragment simulation)', async () => {
    const originalMessage = 'Decryption key stored strictly in URL hash fragment #k=...';
    
    // 1. Generate and export key to base64url string (as placed in URL hash)
    const key = await generateKey();
    const keyString = await exportKey(key);
    assert.equal(typeof keyString, 'string');
    assert.ok(keyString.length >= 43, '256-bit key in Base64URL should be 43-44 chars');

    // 2. Encrypt with key
    const encrypted = await encrypt(originalMessage, key);

    // 3. Decrypt passing the exported string key directly (simulating client URL parsing)
    const decrypted = await decrypt(encrypted, keyString);
    assert.equal(decrypted, originalMessage, 'Decryption with string-imported key must succeed');
  });

  it('verifies tamper resilience: modifying 1 byte of ciphertext causes authentication failure', async () => {
    const message = 'Protected data with 128-bit authentication tag';
    const key = await generateKey();

    const encrypted = await encrypt(message, key);

    // Corrupt one byte of ciphertext
    const corruptedBytes = new Uint8Array(encrypted.ciphertext.slice(0));
    corruptedBytes[0] ^= 0x55; // Flip bits

    await assert.rejects(
      async () => {
        await decrypt(corruptedBytes.buffer, key, encrypted.iv);
      },
      /Integrity Verification Failed|OperationError/i,
      'AES-GCM must reject tampered ciphertext with an authentication error'
    );
  });

  it('verifies wrong key rejection: decrypting with a different key fails', async () => {
    const message = 'Classified transmission';
    const keyA = await generateKey();
    const keyB = await generateKey();

    const encrypted = await encrypt(message, keyA);

    await assert.rejects(
      async () => {
        await decrypt(encrypted, keyB);
      },
      /Integrity Verification Failed|OperationError/i,
      'Attempting decryption with the wrong key must fail authentication'
    );
  });

  it('verifies key fingerprint generation', async () => {
    const key = await generateKey();
    const keyString = await exportKey(key);
    const fingerprint = await getKeyFingerprint(keyString);

    assert.equal(typeof fingerprint, 'string');
    assert.match(fingerprint, /^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/, 'Fingerprint should match XX:XX:XX:XX format');
  });

  it('verifies Base64URL encoding and decoding idempotence', () => {
    const rawBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 255, 128, 0, 64]);
    const encoded = bufferToBase64Url(rawBytes);
    const decoded = new Uint8Array(base64UrlToBuffer(encoded));

    assert.deepEqual(decoded, rawBytes, 'Base64URL roundtrip must preserve exact bytes');
  });

  it('verifies large payload encryption & decryption (1 MB buffer)', async () => {
    const oneMbBuffer = new Uint8Array(1024 * 1024);
    for (let i = 0; i < oneMbBuffer.length; i++) {
      oneMbBuffer[i] = i % 256;
    }

    const key = await generateKey();
    const encrypted = await encrypt(oneMbBuffer, key);
    const decrypted = await decrypt(encrypted, key);

    assert.equal(decrypted.byteLength, oneMbBuffer.byteLength, 'Decrypted buffer size must match 1MB');
    assert.deepEqual(decrypted, oneMbBuffer, '1MB buffer content must match byte-for-byte');
  });
});
