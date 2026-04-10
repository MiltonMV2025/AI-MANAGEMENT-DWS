export type QaPriority = "high" | "medium" | "low";
export type QaTestType = "functional" | "negative" | "edge" | "regression";

export type QaUseCaseDraft = {
  title: string;
  objective: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  priority: QaPriority;
  testType: QaTestType;
};
