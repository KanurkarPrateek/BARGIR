// Stands in for the Resend email service during tests and records what would
// have been sent, one JSON line per email, in tests/e2e/emails.jsonl.
import http from "node:http";
import { appendFileSync } from "node:fs";
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    appendFileSync("tests/e2e/emails.jsonl", body + "\n");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "test" }));
  });
}).listen(Number(process.env.PORT ?? 3300));
