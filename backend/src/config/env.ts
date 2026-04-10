import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env"), override: false });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function defaultPromptPath(): string {
  const explicit = process.env.AI_PROMPT_PATH;
  if (explicit) return explicit;

  const candidates = [
    path.resolve(process.cwd(), "..", "prompts", "qa-use-cases-to-trello-prompt.txt"),
    path.resolve(process.cwd(), "prompts", "qa-use-cases-to-trello-prompt.txt"),
    path.resolve(process.cwd(), "..", "prompts", "teams-to-trello-prompt.txt"),
    path.resolve(process.cwd(), "prompts", "teams-to-trello-prompt.txt"),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }

  return candidates[0];
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:4321",
  sqlServerConnectionString: required("SQL_SERVER_CONNECTION_STRING"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  emailEncryptionKey: required("EMAIL_ENCRYPTION_KEY"),
  googleAiApiKey: required("GOOGLE_AI_API_KEY"),
  googleAiModel: process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash-lite",
  aiPromptPath: defaultPromptPath(),
  trelloKey: process.env.TRELLO_KEY ?? "",
  trelloToken: process.env.TRELLO_TOKEN ?? "",
  trelloListIds: {
    functional: process.env.TRELLO_LIST_ID_FUNCTIONAL ?? "",
    negative: process.env.TRELLO_LIST_ID_NEGATIVE ?? "",
    edge: process.env.TRELLO_LIST_ID_EDGE ?? "",
    regression: process.env.TRELLO_LIST_ID_REGRESSION ?? "",
  },
};
