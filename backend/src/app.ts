import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { authRouter } from "./routes/authRoutes.js";
import { projectRouter } from "./routes/projectRoutes.js";

const allowedOrigins = env.corsOrigin
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function corsOriginValidator(origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void): void {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error("CORS blocked for this origin."));
}

export const app = express();

app.use(cors({ origin: corsOriginValidator }));
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", authRouter);
app.use("/api", projectRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ message: error.message || "Internal server error" });
});
