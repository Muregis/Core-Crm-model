const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// Ensure 32-byte key
const RAW_KEY = process.env.ENCRYPTION_KEY || 'core_crm_kenya_master_key_32bytes!';
const KEY = crypto.createHash('sha256').update(String(RAW_KEY)).digest();

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} text Plaintext to encrypt
 * @returns {object} { encryptedText: string, iv: string, tag: string }
 */
function encrypt(text) {
  if (!text) return { encryptedText: '', iv: '', tag: '' };
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    encryptedText: encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param {string} encryptedText Hex-encoded ciphertext
 * @param {string} iv Hex-encoded IV
 * @param {string} tag Hex-encoded authentication tag
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedText, iv, tag) {
  if (!encryptedText || !iv) return '';
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
  if (tag) {
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
  }
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Mask sensitive data for logs / display
 * e.g., '+254712345678' -> '+2547****5678'
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.length < 7) return '******';
  const start = phone.slice(0, 5);
  const end = phone.slice(-3);
  return `${start}****${end}`;
}

/**
 * Mask credential keys
 * e.g., 'abcdef1234567890' -> 'abcd****7890'
 */
function maskApiKey(key) {
  if (!key || key.length < 8) return '********';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

module.exports = {
  encrypt,
  decrypt,
  maskPhoneNumber,
  maskApiKey
};
