import fs from "node:fs";
import { env } from "../config/env.js";
import type { QaPriority, QaTestType, QaUseCaseDraft } from "../types/qaUseCases.js";

const allowedPriorities = new Set<QaPriority>(["high", "medium", "low"]);
const allowedTestTypes = new Set<QaTestType>(["functional", "negative", "edge", "regression"]);

type AIExtractionResult = {
  model: string;
  useCases: QaUseCaseDraft[];
  rawResponse: unknown;
};

function readPromptFile(): string {
  return fs.readFileSync(env.aiPromptPath, "utf8");
}

export function getDefaultSystemPrompt(): string {
  return readPromptFile();
}

function getResponseText(payload: any): string {
  const parts = payload?.candidates
    ?.flatMap((candidate: any) => candidate?.content?.parts ?? [])
    ?.map((part: any) => part?.text)
    ?.filter(Boolean);

  if (!parts?.length) {
    throw new Error("Model response did not include text.");
  }
  return String(parts.join("\n")).trim();
}

function removeMarkdownFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : text.trim();
}

function limitTitleWords(title: string, maxWords = 12): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function normalizeSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error("AI output item must include steps as a JSON array.");
  }
  const steps = raw
    .map((step) => String(step ?? "").trim())
    .filter(Boolean);
  if (!steps.length) {
    throw new Error("AI output item must include at least one test step.");
  }
  return steps;
}

function normalizePriority(value: unknown): QaPriority {
  const priority = String(value ?? "").trim().toLowerCase() as QaPriority;
  if (!allowedPriorities.has(priority)) {
    throw new Error(`Invalid priority in AI output: ${priority}`);
  }
  return priority;
}

function normalizeTestType(value: unknown): QaTestType {
  const testType = String(value ?? "").trim().toLowerCase() as QaTestType;
  if (!allowedTestTypes.has(testType)) {
    throw new Error(`Invalid testType in AI output: ${testType}`);
  }
  return testType;
}

function normalizeUseCase(raw: any): QaUseCaseDraft {
  const title = limitTitleWords(String(raw?.title ?? "").trim());
  const objective = String(raw?.objective ?? "").trim();
  const preconditions = String(raw?.preconditions ?? "").trim();
  const steps = normalizeSteps(raw?.steps);
  const expectedResult = String(raw?.expectedResult ?? "").trim();
  const priority = normalizePriority(raw?.priority);
  const testType = normalizeTestType(raw?.testType);

  if (!title) throw new Error("AI output item missing title.");
  if (!objective) throw new Error("AI output item missing objective.");
  if (!expectedResult) throw new Error("AI output item missing expectedResult.");

  return {
    title,
    objective,
    preconditions,
    steps,
    expectedResult,
    priority,
    testType,
  };
}

async function callGemini(inputText: string, promptText: string): Promise<{
  payload: unknown;
  model: string;
}> {
  const model = env.googleAiModel;
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.googleAiApiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: promptText }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `QA Input Context:\n${inputText}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    const message =
      (payload as any)?.error?.message || rawText || `Google AI request failed: ${response.status}`;
    throw new Error(message);
  }

  return { payload, model };
}

export async function extractQaUseCasesFromInput(
  inputText: string,
  options?: { promptText?: string }
): Promise<AIExtractionResult> {
  const promptText = options?.promptText?.trim() || readPromptFile();
  const { payload, model } = await callGemini(inputText, promptText);
  const text = getResponseText(payload);

  let parsed: unknown;
  try {
    parsed = JSON.parse(removeMarkdownFence(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON output";
    throw new Error(`AI output is not valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI output must be a JSON array.");
  }

  const useCases = parsed.map((item) => normalizeUseCase(item));

  return {
    model,
    useCases,
    rawResponse: payload,
  };
}
