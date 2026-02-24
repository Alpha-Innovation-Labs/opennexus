import fs from "node:fs";
import pino from "pino";

const logsDir = "./logs";

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = pino(
  {
    name: "cdd-web-ui",
    level: process.env.LOG_LEVEL ?? "info",
  },
  pino.destination({
    dest: `${logsDir}/web-server.log`,
    mkdir: true,
    append: true,
    sync: false,
  }),
);
