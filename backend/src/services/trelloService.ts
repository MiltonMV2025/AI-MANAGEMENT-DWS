import { env } from "../config/env.js";
import type { QaPriority, QaTestType } from "../types/qaUseCases.js";

const testTypeToListId: Record<QaTestType, string> = {
  functional: env.trelloListIds.functional,
  negative: env.trelloListIds.negative,
  edge: env.trelloListIds.edge,
  regression: env.trelloListIds.regression,
};

export function isTrelloConfigured(): boolean {
  return Boolean(
    env.trelloKey &&
      env.trelloToken &&
      testTypeToListId.functional &&
      testTypeToListId.negative &&
      testTypeToListId.edge &&
      testTypeToListId.regression
  );
}

export async function createTrelloCard(input: {
  title: string;
  objective: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: QaPriority;
  testType: QaTestType;
}): Promise<{ cardId: string; cardUrl: string | null }> {
  const listId = testTypeToListId[input.testType];
  if (!listId) {
    throw new Error(`No Trello list configured for test type: ${input.testType}`);
  }

  const stepsText = input.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const preconditions = input.preconditions || "None.";
  const description = [
    `Objective:\n${input.objective}`,
    `Preconditions:\n${preconditions}`,
    `Test Steps:\n${stepsText}`,
    `Expected Result:\n${input.expectedResult}`,
    `Priority: ${input.priority.toUpperCase()}`,
    `Test Type: ${input.testType}`,
  ].join("\n\n");

  const body = new URLSearchParams({
    key: env.trelloKey,
    token: env.trelloToken,
    idList: listId,
    name: input.title,
    desc: description,
  });

  const response = await fetch("https://api.trello.com/1/cards", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || raw || `Trello error ${response.status}`;
    throw new Error(message);
  }

  if (!payload?.id) {
    throw new Error("Trello did not return card id.");
  }

  return {
    cardId: String(payload.id),
    cardUrl: typeof payload.shortUrl === "string"
      ? payload.shortUrl
      : typeof payload.url === "string"
        ? payload.url
        : null,
  };
}
