import http from "http";
import { logger } from "./logger";
import { config } from "./config";
import { verifySmartHost } from "./relay";

/**
 * Tiny HTTP server that answers /health for DigitalOcean / Docker
 * health checks, and /ready which additionally verifies the smart
 * host is reachable.
 */
export function createHealthServer(): http.Server {
  return http.createServer(async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }
    if (req.url === "/ready") {
      const smartHostOk = await verifySmartHost();
      const body = {
        status: smartHostOk ? "ok" : "degraded",
        smartHostReachable: smartHostOk,
        uptime: process.uptime(),
      };
      res.writeHead(smartHostOk ? 200 : 503, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(404);
    res.end();
  });
}

export function startHealthServer(): void {
  const server = createHealthServer();
  server.listen(config.healthPort, () => {
    logger.info({ port: config.healthPort }, "Health endpoint listening");
  });
}
