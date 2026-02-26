import fs from "node:fs";
import pino from "pino";

const logsDir = "./logs";

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = pino(
  {
    name: "cdd-react-flow-ui",
    level: process.env.LOG_LEVEL ?? "info",
  },
  pino.destination({
    dest: `${logsDir}/react-flow-server.log`,
    mkdir: true,
    append: true,
    sync: false,
  }),
);
