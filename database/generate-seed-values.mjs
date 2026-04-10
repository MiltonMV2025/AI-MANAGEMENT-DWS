import { createCipheriv, createHash } from "node:crypto";

const keyHex = process.env.EMAIL_ENCRYPTION_KEY || "";
const email = process.env.SEED_ADMIN_EMAIL || "";
const username = process.env.SEED_ADMIN_USERNAME || "";
const password = process.env.SEED_ADMIN_PASSWORD || "";

if (!keyHex || !email || !username || !password) {
  console.error("Missing required env vars:");
  console.error("EMAIL_ENCRYPTION_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD");
  process.exit(1);
}

const key = Buffer.from(keyHex, "hex");
if (key.length !== 32) {
  console.error("EMAIL_ENCRYPTION_KEY must be 64 hex chars.");
  process.exit(1);
}

const iv = createHash("sha256").update(key).digest().subarray(0, 16);

function encryptEmailDeterministic(value) {
  const normalized = value.trim().toLowerCase();
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]).toString("base64url");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

const encryptedEmail = encryptEmailDeterministic(email);
const passwordSha256 = sha256Hex(password);

console.log("-- Copy and run this SQL:");
console.log(
  `MERGE dbo.users AS target
USING (SELECT
  '${username.replace(/'/g, "''")}' AS username,
  '${encryptedEmail}' AS email_encrypted,
  '${passwordSha256}' AS password_sha256
) AS source
ON target.username = source.username
WHEN MATCHED THEN
  UPDATE SET
    email_encrypted = source.email_encrypted,
    password_sha256 = source.password_sha256
WHEN NOT MATCHED THEN
  INSERT (username, email_encrypted, password_sha256)
  VALUES (source.username, source.email_encrypted, source.password_sha256);`
);
