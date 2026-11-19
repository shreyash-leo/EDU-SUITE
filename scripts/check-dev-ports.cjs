// Fail before either development server starts if another copy owns its port.
const net = require("node:net");
async function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (listening) => { socket.destroy(); resolve(listening); };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}
(async () => {
  const ports = [3000, Number(process.env.API_PORT || 4000)];
  const occupied = (await Promise.all(ports.map(async port => await isListening(port) ? port : null))).filter(Boolean);
  if (occupied.length) {
    console.error(
      `Cannot start development: port${occupied.length > 1 ? "s" : ""} ${occupied.join(", ")} already in use.\n` +
      `If Docker is running the app, stop just its app services:\n  docker compose stop api web\n` +
      `Keep postgres and minio running, then run npm run dev again.\n` +
      `If another npm run dev is running, use that terminal or stop it first.\n` +
      `Docker serves a saved build; source changes appear in development. For Docker-only updates, use docker compose up -d --build.`
    );
    process.exitCode = 1;
  }
})();
