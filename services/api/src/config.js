export const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  apiName: process.env.API_NAME || "Cronan & Locke Systems API",
  databaseUrl: process.env.DATABASE_URL || "",
  storageBackend: process.env.STORAGE_BACKEND || (process.env.DATABASE_URL ? "postgres" : "json")
};
