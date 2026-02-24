const DEFAULT_DB_PATH = ".nexus/context/observability.sqlite";
const DEFAULT_PORT = "4173";

export const env = {
  cddDbPath: process.env.CDD_DB_PATH ?? DEFAULT_DB_PATH,
  cddUiPort: process.env.CDD_UI_PORT ?? DEFAULT_PORT,
};
