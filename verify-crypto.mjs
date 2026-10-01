import {
  generateKey,
  exportKey,
  encrypt,
  decrypt,
  bufferToBase64Url,
  getKeyFingerprint,
} from './client/src/cryptoUtils.js';

// Get custom text from terminal argument, or use a default test string
const customText = process.argv.slice(2).join(' ') || 'Classified test message: zero-knowledge verification successful!';

async function runVerification() {
  console.log('='.repeat(65));
  console.log(' GUARDIANBOX: TERMINAL ENCRYPTION & DECRYPTION ROUNDTRIP');
  console.log('='.repeat(65));

  // Step 1: Input Data
  console.log('\n[1] ORIGINAL PLAINTEXT:');
  console.log(`    "${customText}"`);
  console.log(`    Length: ${Buffer.byteLength(customText, 'utf8')} bytes`);

  // Step 2: Key Generation
  console.log('\n[2] GENERATING AES-GCM 256-BIT KEY:');
  const key = await generateKey();
  const exportedKeyStr = await exportKey(key);
  const fingerprint = await getKeyFingerprint(exportedKeyStr);
  console.log(`    Secret Key (Base64URL): ${exportedKeyStr}`);
  console.log(`    Key Fingerprint:        ${fingerprint}`);

  // Step 3: Encryption
  console.log('\n[3] ENCRYPTING WITH encrypt(data, key):');
  const encrypted = await encrypt(customText, key);
  const ivBase64 = bufferToBase64Url(encrypted.iv);
  const ciphertextBase64 = bufferToBase64Url(encrypted.ciphertext);

  console.log(`    Random IV (96 bits):     ${ivBase64}`);
  console.log(`    Ciphertext + Auth Tag:   ${ciphertextBase64.slice(0, 32)}... (total: ${encrypted.ciphertext.byteLength} bytes)`);
  console.log(`    Packed Buffer Size:      ${encrypted.packed.byteLength} bytes (12B IV + ${encrypted.ciphertext.byteLength}B ciphertext)`);

  // Step 4: Decryption using the exported key string
  console.log('\n[4] DECRYPTING WITH decrypt(ciphertext, key):');
  // Pass encrypted container and the exported key string to simulate real-world workflow
  const decrypted = await decrypt(encrypted, exportedKeyStr);
  console.log(`    Decrypted Result:        "${decrypted}"`);

  // Step 5: Verification Check
  console.log('\n[5] VERIFICATION CHECK:');
  const isMatch = decrypted === customText;
  if (isMatch) {
    console.log('    [PASSED] Roundtrip exact match: Decrypted text === Original text');
  } else {
    console.error('    [FAILED] Decrypted text did NOT match original text.');
    process.exitCode = 1;
  }
  console.log('='.repeat(65));
}

runVerification().catch((err) => {
  console.error('Crypto error occurred:', err);
  process.exitCode = 1;
});
