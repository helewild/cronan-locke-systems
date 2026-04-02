import crypto from "node:crypto";
import { getStore, writeStore } from "../src/data/store.js";

function hashPassword(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

const USERNAME = process.env.PLATFORM_ADMIN_USERNAME || "platformadmin";
const PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || "demo123";
const AVATAR_NAME = process.env.PLATFORM_ADMIN_AVATAR || "Cronan & Locke Operator";

const store = await getStore();
store.users = Array.isArray(store.users) ? store.users : [];

const existing = store.users.find((user) => String(user.username || "").trim().toLowerCase() === USERNAME.toLowerCase());

if (existing) {
  existing.tenant_id = "platform-root";
  existing.role = "platform_admin";
  existing.avatar_name = AVATAR_NAME;
  existing.status = "ACTIVE";
  existing.password_hash = hashPassword(PASSWORD);
  existing.must_reset_password = false;
  existing.session_token = "";
  existing.session_expires_at = "";
  await writeStore(store);
  console.log(`Updated existing platform admin '${USERNAME}'.`);
  process.exit(0);
}

store.users.push({
  user_id: "USR-10000",
  tenant_id: "platform-root",
  username: USERNAME,
  password_hash: hashPassword(PASSWORD),
  role: "platform_admin",
  avatar_name: AVATAR_NAME,
  status: "ACTIVE",
  session_token: "",
  session_expires_at: "",
  must_reset_password: false
});

await writeStore(store);
console.log(`Created platform admin '${USERNAME}'.`);
