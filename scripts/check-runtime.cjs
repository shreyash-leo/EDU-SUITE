const crypto = require("node:crypto");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 24 || (major === 24 && minor < 11) || typeof crypto.argon2 !== "function") {
  console.error(
    `PLAN EDU SUITE requires Node 24.11 or newer with built-in Argon2.\n` +
    `Current runtime: ${process.version} (${process.execPath}).\n` +
    `Switch Node versions before starting. With nvm: nvm install && nvm use.\n` +
    `On this Mac, the existing installation is available with: export PATH="/usr/local/bin:$PATH"`,
  );
  process.exit(1);
}
console.log(`Runtime OK: Node ${process.versions.node} with built-in Argon2.`);
