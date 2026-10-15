// Stands in for the WhatsApp sender during tests, so no test message can ever
// reach WhatsApp. It reports "not linked" (with a QR) and accepts wake-ups.
import http from "node:http";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC";
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  if (/^\/sessions\/[\w-]+\/groups$/.test(req.url)) {
    return res.end(JSON.stringify({ groups: [
      { id: "120363000000000001@g.us", name: "Test Gym Members", size: 42, isAdmin: true },
      { id: "120363000000000002@g.us", name: "Family chat", size: 7, isAdmin: false },
    ] }));
  }
  res.end(JSON.stringify(req.url.startsWith("/sessions/") ? { state: "qr", qr: PNG } : { ok: true }));
}).listen(Number(process.env.PORT ?? 3201));
