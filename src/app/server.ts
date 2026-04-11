import { createServer } from "node:http";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ service: "raider-bot", status: "ok" }));
});

server.listen(env.APP_PORT, () => {
  logger.info({ port: env.APP_PORT }, "Raider Bot foundation server listening.");
});
