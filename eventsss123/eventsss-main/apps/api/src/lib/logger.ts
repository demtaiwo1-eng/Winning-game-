import pino from "pino";
import { env } from "../config/env";

// pino-http includes request headers in its default request serializer. Redact
// the complete header object so bearer tokens, cookies, payment signatures and
// other credentials can never be copied into Render or other application logs.
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: {
    paths: ["req.headers"],
    censor: "[REDACTED]",
  },
});
