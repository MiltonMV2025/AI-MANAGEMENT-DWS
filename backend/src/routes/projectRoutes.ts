
import { Router } from "express";
import { query, runInTransaction } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/requireAuth.js";
import { extractQaUseCasesFromInput, getDefaultSystemPrompt } from "../services/aiService.js";
import { createTrelloCard, isTrelloConfigured } from "../services/trelloService.js";
import type { QaPriority, QaTestType } from "../types/qaUseCases.js";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  icon_name: string;
  created_at: string;
  session_count: string;
};

type TrelloSyncStatus = "pending" | "sent" | "failed";

type ProjectSessionStatus = "draft" | "preview_ready" | "synced" | "partial" | "error";

type ProjectSessionRow = {
  id: string;
  project_id: string;
  created_by_user_id: string;
  name: string;
  icon_name: string;
  source_input: string | null;
  status: ProjectSessionStatus;
  ai_model: string | null;
  ai_raw_response: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SessionPreviewCardRow = {
  id: string;
  session_id: string;
  title: string;
  objective: string;
  preconditions: string;
  test_steps_json: string;
  expected_result: string;
  priority: QaPriority;
  list_type: QaTestType;
  trello_card_id: string | null;
  trello_card_url: string | null;
  trello_status: TrelloSyncStatus;
  trello_error: string | null;
  created_at: string;
};

type PromptTemplateRow = {
  id: string;
  user_id: string;
  template_key: string;
  title: string;
  content: string;
  updated_at: string;
};

type SyncSummary = {
  sentCount: number;
  failedCount: number;
  sent: Array<{ useCaseId: string; trelloCardId: string; trelloCardUrl: string | null }>;
  failed: Array<{ useCaseId: string; reason: string }>;
};

const validIconNames = new Set(["folder", "bug", "shield", "cart", "cloud", "server", "rocket", "key", "cpu"]);
const validPriorities: QaPriority[] = ["high", "medium", "low"];
const validListTypes: QaTestType[] = ["functional", "negative", "edge", "regression"];
const promptTemplateKey = "system";

export const projectRouter = Router();
projectRouter.use(requireAuth);

function parseSteps(stepsJson: string): string[] {
  try {
    const parsed = JSON.parse(stepsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((step) => String(step ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeIconName(value: unknown): string {
  const icon = String(value ?? "").trim().toLowerCase();
  if (validIconNames.has(icon)) return icon;
  return "folder";
}

function parseEditableSteps(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function toApiPreviewCard(card: SessionPreviewCardRow) {
  return {
    id: card.id,
    sessionId: card.session_id,
    title: card.title,
    objective: card.objective,
    preconditions: card.preconditions,
    steps: parseSteps(card.test_steps_json),
    expectedResult: card.expected_result,
    priority: card.priority,
    listType: card.list_type,
    trello: {
      status: card.trello_status,
      cardId: card.trello_card_id,
      cardUrl: card.trello_card_url,
      error: card.trello_error,
    },
    createdAt: card.created_at,
  };
}

async function assertProjectOwnership(projectId: string, userId: string): Promise<void> {
  const result = await query<{ id: string }>(
    "SELECT TOP 1 id FROM projects WHERE id = $1 AND owner_user_id = $2",
    [projectId, userId]
  );
  if (!result.rows[0]) {
    throw new Error("Project not found or access denied.");
  }
}

async function getSessionOwnedByUser(sessionId: string, userId: string): Promise<ProjectSessionRow | null> {
  const result = await query<ProjectSessionRow>(
    `
    SELECT TOP 1
      s.id, s.project_id, s.created_by_user_id, s.name, s.icon_name, s.source_input,
      s.status, s.ai_model, s.ai_raw_response, s.error_message, s.created_at, s.updated_at
    FROM project_sessions s
    INNER JOIN projects p ON p.id = s.project_id
    WHERE s.id = $1
      AND p.owner_user_id = $2
    `,
    [sessionId, userId]
  );

  return result.rows[0] ?? null;
}

async function getSessionPreviewCards(sessionId: string): Promise<SessionPreviewCardRow[]> {
  const result = await query<SessionPreviewCardRow>(
    `
    SELECT
      id, session_id, title, objective, preconditions, test_steps_json, expected_result,
      priority, list_type, trello_card_id, trello_card_url, trello_status, trello_error, created_at
    FROM session_preview_cards
    WHERE session_id = $1
    ORDER BY created_at ASC
    `,
    [sessionId]
  );
  return result.rows;
}

async function getUserSystemPrompt(userId: string): Promise<{ title: string; content: string; updatedAt: string | null; source: "db" | "default" }> {
  const templateResult = await query<PromptTemplateRow>(
    `
    SELECT TOP 1 id, user_id, template_key, title, content, updated_at
    FROM prompt_templates
    WHERE user_id = $1
      AND template_key = $2
      AND is_active = 1
    ORDER BY updated_at DESC
    `,
    [userId, promptTemplateKey]
  );

  const template = templateResult.rows[0];
  if (template) {
    return {
      title: template.title,
      content: template.content,
      updatedAt: template.updated_at,
      source: "db",
    };
  }

  return {
    title: "System Prompt",
    content: getDefaultSystemPrompt(),
    updatedAt: null,
    source: "default",
  };
}

async function upsertUserSystemPrompt(userId: string, content: string, title: string): Promise<PromptTemplateRow> {
  const existing = await query<PromptTemplateRow>(
    `
    SELECT TOP 1 id, user_id, template_key, title, content, updated_at
    FROM prompt_templates
    WHERE user_id = $1
      AND template_key = $2
    `,
    [userId, promptTemplateKey]
  );

  if (existing.rows[0]) {
    const updated = await query<PromptTemplateRow>(
      `
      UPDATE prompt_templates
      SET title = $2,
          content = $3,
          is_active = 1,
          updated_at = SYSUTCDATETIME()
      OUTPUT inserted.id, inserted.user_id, inserted.template_key, inserted.title, inserted.content, inserted.updated_at
      WHERE id = $1
      `,
      [existing.rows[0].id, title, content]
    );

    return updated.rows[0];
  }

  const inserted = await query<PromptTemplateRow>(
    `
    INSERT INTO prompt_templates (user_id, template_key, title, content, is_active)
    OUTPUT inserted.id, inserted.user_id, inserted.template_key, inserted.title, inserted.content, inserted.updated_at
    VALUES ($1, $2, $3, $4, 1)
    `,
    [userId, promptTemplateKey, title, content]
  );

  return inserted.rows[0];
}

async function syncSessionPreviewCardsToTrello(cards: SessionPreviewCardRow[]): Promise<SyncSummary> {
  const sent: Array<{ useCaseId: string; trelloCardId: string; trelloCardUrl: string | null }> = [];
  const failed: Array<{ useCaseId: string; reason: string }> = [];

  for (const card of cards) {
    try {
      const created = await createTrelloCard({
        title: card.title,
        objective: card.objective,
        preconditions: card.preconditions,
        steps: parseSteps(card.test_steps_json),
        expectedResult: card.expected_result,
        priority: card.priority,
        testType: card.list_type,
      });

      await query(
        `
        UPDATE session_preview_cards
        SET trello_card_id = $2,
            trello_card_url = $3,
            trello_status = 'sent',
            trello_error = NULL
        WHERE id = $1
        `,
        [card.id, created.cardId, created.cardUrl]
      );

      sent.push({
        useCaseId: card.id,
        trelloCardId: created.cardId,
        trelloCardUrl: created.cardUrl,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Trello error";
      await query(
        `
        UPDATE session_preview_cards
        SET trello_status = 'failed',
            trello_error = $2
        WHERE id = $1
        `,
        [card.id, reason]
      );
      failed.push({ useCaseId: card.id, reason });
    }
  }

  return {
    sentCount: sent.length,
    failedCount: failed.length,
    sent,
    failed,
  };
}

projectRouter.get("/projects", async (req, res) => {
  const userId = req.authUser!.userId;
  const rawSearch = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const search = String(rawSearch ?? "").trim();
  const rawOrder = Array.isArray(req.query.order) ? req.query.order[0] : req.query.order;
  const order = String(rawOrder ?? "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC";

  const result = await query<ProjectRow>(
    `
    SELECT
      p.id,
      p.name,
      p.description,
      p.icon_name,
      p.created_at,
      COUNT(s.id) AS session_count
    FROM projects p
    LEFT JOIN project_sessions s ON s.project_id = p.id
    WHERE p.owner_user_id = $1
      AND (
        $2 = ''
        OR p.name LIKE '%' + $2 + '%'
        OR ISNULL(p.description, '') LIKE '%' + $2 + '%'
      )
    GROUP BY p.id, p.name, p.description, p.icon_name, p.created_at
    ORDER BY p.created_at ${order}
    `,
    [userId, search]
  );

  res.json({
    projects: result.rows.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      iconName: project.icon_name,
      createdAt: project.created_at,
      runCount: Number(project.session_count),
      sessionCount: Number(project.session_count),
    })),
  });
});

projectRouter.get("/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;
  const userId = req.authUser!.userId;

  const result = await query<ProjectRow>(
    `
    SELECT
      p.id,
      p.name,
      p.description,
      p.icon_name,
      p.created_at,
      COUNT(s.id) AS session_count
    FROM projects p
    LEFT JOIN project_sessions s ON s.project_id = p.id
    WHERE p.id = $1
      AND p.owner_user_id = $2
    GROUP BY p.id, p.name, p.description, p.icon_name, p.created_at
    `,
    [projectId, userId]
  );

  const project = result.rows[0];
  if (!project) {
    res.status(404).json({ message: "Project not found or access denied." });
    return;
  }

  res.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      iconName: project.icon_name,
      createdAt: project.created_at,
      runCount: Number(project.session_count),
      sessionCount: Number(project.session_count),
    },
  });
});

projectRouter.post("/projects", async (req, res) => {
  const userId = req.authUser!.userId;
  const { name, description, iconName } = req.body as {
    name?: string;
    description?: string;
    iconName?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ message: "Project name is required." });
    return;
  }

  const result = await query<{ id: string; name: string; description: string | null; icon_name: string; created_at: string }>(
    `
    INSERT INTO projects (owner_user_id, name, description, icon_name)
    OUTPUT inserted.id, inserted.name, inserted.description, inserted.icon_name, inserted.created_at
    VALUES ($1, $2, $3, $4)
    `,
    [userId, name.trim(), description?.trim() || null, normalizeIconName(iconName)]
  );

  const project = result.rows[0];
  res.status(201).json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      iconName: project.icon_name,
      createdAt: project.created_at,
      runCount: 0,
      sessionCount: 0,
    },
  });
});

projectRouter.delete("/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;
  const userId = req.authUser!.userId;

  const deleted = await query<{ id: string; name: string }>(
    `
    DELETE FROM projects
    OUTPUT deleted.id, deleted.name
    WHERE id = $1
      AND owner_user_id = $2
    `,
    [projectId, userId]
  );

  const project = deleted.rows[0];
  if (!project) {
    res.status(404).json({ message: "Project not found or access denied." });
    return;
  }

  res.json({
    message: "Project removed from Niro.",
    project: {
      id: project.id,
      name: project.name,
    },
  });
});
projectRouter.get("/projects/:projectId/sessions", async (req, res) => {
  const { projectId } = req.params;
  const userId = req.authUser!.userId;

  try {
    await assertProjectOwnership(projectId, userId);
  } catch {
    res.status(404).json({ message: "Project not found or access denied." });
    return;
  }

  const sessions = await query<ProjectSessionRow>(
    `
    SELECT
      id, project_id, created_by_user_id, name, icon_name, source_input,
      status, ai_model, ai_raw_response, error_message, created_at, updated_at
    FROM project_sessions
    WHERE project_id = $1
    ORDER BY created_at DESC
    `,
    [projectId]
  );

  res.json({
    sessions: sessions.rows.map((session) => ({
      id: session.id,
      projectId: session.project_id,
      createdByUserId: session.created_by_user_id,
      name: session.name,
      iconName: session.icon_name,
      sourceInput: session.source_input,
      status: session.status,
      aiModel: session.ai_model,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    })),
  });
});

projectRouter.delete("/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.authUser!.userId;

  const session = await getSessionOwnedByUser(sessionId, userId);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }

  await query(
    `
    DELETE FROM project_sessions
    WHERE id = $1
    `,
    [sessionId]
  );

  res.json({
    message: "Session removed from Niro.",
    session: {
      id: session.id,
      projectId: session.project_id,
      name: session.name,
    },
  });
});

projectRouter.post("/projects/:projectId/sessions", async (req, res) => {
  const { projectId } = req.params;
  const userId = req.authUser!.userId;
  const { name, iconName, sourceInput } = req.body as {
    name?: string;
    iconName?: string;
    sourceInput?: string;
  };

  try {
    await assertProjectOwnership(projectId, userId);
  } catch {
    res.status(404).json({ message: "Project not found or access denied." });
    return;
  }

  if (!name?.trim()) {
    res.status(400).json({ message: "Session name is required." });
    return;
  }

  const created = await query<ProjectSessionRow>(
    `
    INSERT INTO project_sessions (project_id, created_by_user_id, name, icon_name, source_input, status)
    OUTPUT
      inserted.id, inserted.project_id, inserted.created_by_user_id, inserted.name, inserted.icon_name,
      inserted.source_input, inserted.status, inserted.ai_model, inserted.ai_raw_response, inserted.error_message,
      inserted.created_at, inserted.updated_at
    VALUES ($1, $2, $3, $4, $5, 'draft')
    `,
    [projectId, userId, name.trim(), normalizeIconName(iconName), sourceInput?.trim() || null]
  );

  const session = created.rows[0];
  res.status(201).json({
    session: {
      id: session.id,
      projectId: session.project_id,
      createdByUserId: session.created_by_user_id,
      name: session.name,
      iconName: session.icon_name,
      sourceInput: session.source_input,
      status: session.status,
      aiModel: session.ai_model,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      previewCards: [],
    },
  });
});

projectRouter.get("/sessions/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.authUser!.userId;

  const session = await getSessionOwnedByUser(sessionId, userId);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }

  const previewCards = await getSessionPreviewCards(sessionId);

  res.json({
    session: {
      id: session.id,
      projectId: session.project_id,
      createdByUserId: session.created_by_user_id,
      name: session.name,
      iconName: session.icon_name,
      sourceInput: session.source_input,
      status: session.status,
      aiModel: session.ai_model,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      previewCards: previewCards.map((card) => toApiPreviewCard(card)),
    },
  });
});

projectRouter.post("/sessions/:sessionId/process-preview", async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.authUser!.userId;
  const { input, featureName } = req.body as {
    input?: string;
    featureName?: string;
  };

  const session = await getSessionOwnedByUser(sessionId, userId);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }

  const normalizedInput = String(input ?? session.source_input ?? "").trim();
  if (!normalizedInput) {
    res.status(400).json({ message: "Session input is required." });
    return;
  }
  const normalizedFeatureName = String(featureName ?? session.name ?? "").trim() || session.name;

  try {
    const prompt = await getUserSystemPrompt(userId);
    const aiResult = await extractQaUseCasesFromInput(normalizedInput, { promptText: prompt.content });

    await runInTransaction(async (txQuery) => {
      await txQuery(
        `
        UPDATE project_sessions
        SET source_input = $2,
            name = $3,
            status = 'preview_ready',
            ai_model = $4,
            ai_raw_response = $5,
            error_message = NULL,
            updated_at = SYSUTCDATETIME()
        WHERE id = $1
        `,
        [sessionId, normalizedInput, normalizedFeatureName, aiResult.model, JSON.stringify(aiResult.rawResponse)]
      );

      await txQuery("DELETE FROM session_preview_cards WHERE session_id = $1", [sessionId]);

      for (const useCase of aiResult.useCases) {
        await txQuery(
          `
          INSERT INTO session_preview_cards
            (session_id, title, objective, preconditions, test_steps_json, expected_result, priority, list_type, trello_status)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
          `,
          [
            sessionId,
            useCase.title,
            useCase.objective,
            useCase.preconditions,
            JSON.stringify(useCase.steps),
            useCase.expectedResult,
            useCase.priority,
            useCase.testType,
          ]
        );
      }

    });

    const refreshedSession = await getSessionOwnedByUser(sessionId, userId);
    const previewCards = await getSessionPreviewCards(sessionId);

    res.json({
      session: {
        id: refreshedSession!.id,
        projectId: refreshedSession!.project_id,
        createdByUserId: refreshedSession!.created_by_user_id,
        name: refreshedSession!.name,
        iconName: refreshedSession!.icon_name,
        sourceInput: refreshedSession!.source_input,
        status: refreshedSession!.status,
        aiModel: refreshedSession!.ai_model,
        errorMessage: refreshedSession!.error_message,
        createdAt: refreshedSession!.created_at,
        updatedAt: refreshedSession!.updated_at,
        previewCards: previewCards.map((card) => toApiPreviewCard(card)),
      },
      promptTemplate: {
        key: promptTemplateKey,
        source: prompt.source,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session preview generation failed";
    await query(
      `
      UPDATE project_sessions
      SET status = 'error',
          error_message = $2,
          updated_at = SYSUTCDATETIME()
      WHERE id = $1
      `,
      [sessionId, message]
    );
    res.status(502).json({ message });
  }
});

projectRouter.patch("/sessions/:sessionId/preview-cards/:cardId", async (req, res) => {
  const { sessionId, cardId } = req.params;
  const userId = req.authUser!.userId;
  const payload = req.body as {
    title?: unknown;
    steps?: unknown;
    expectedResult?: unknown;
    priority?: unknown;
    listType?: unknown;
  };

  const session = await getSessionOwnedByUser(sessionId, userId);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }

  const existingResult = await query<SessionPreviewCardRow>(
    `
    SELECT TOP 1
      id, session_id, title, objective, preconditions, test_steps_json, expected_result,
      priority, list_type, trello_card_id, trello_card_url, trello_status, trello_error, created_at
    FROM session_preview_cards
    WHERE id = $1 AND session_id = $2
    `,
    [cardId, sessionId]
  );

  const existingCard = existingResult.rows[0];
  if (!existingCard) {
    res.status(404).json({ message: "Preview card not found." });
    return;
  }

  const title =
    payload.title === undefined ? existingCard.title : String(payload.title ?? "").trim();
  if (!title) {
    res.status(400).json({ message: "Card title is required." });
    return;
  }

  const expectedResult =
    payload.expectedResult === undefined
      ? existingCard.expected_result
      : String(payload.expectedResult ?? "").trim();
  if (!expectedResult) {
    res.status(400).json({ message: "Expected result is required." });
    return;
  }

  const parsedSteps =
    payload.steps === undefined ? parseSteps(existingCard.test_steps_json) : parseEditableSteps(payload.steps);
  if (!parsedSteps.length) {
    res.status(400).json({ message: "At least one test step is required." });
    return;
  }

  const priorityRaw = payload.priority === undefined ? existingCard.priority : String(payload.priority ?? "").trim().toLowerCase();
  const priority = validPriorities.find((item) => item === priorityRaw);
  if (!priority) {
    res.status(400).json({ message: "Invalid priority. Use high, medium or low." });
    return;
  }

  const listTypeRaw = payload.listType === undefined ? existingCard.list_type : String(payload.listType ?? "").trim().toLowerCase();
  const listType = validListTypes.find((item) => item === listTypeRaw);
  if (!listType) {
    res.status(400).json({ message: "Invalid list type. Use functional, negative, edge or regression." });
    return;
  }

  const updatedCard = await query<SessionPreviewCardRow>(
    `
    UPDATE session_preview_cards
    SET title = $3,
        expected_result = $4,
        test_steps_json = $5,
        priority = $6,
        list_type = $7,
        trello_card_id = NULL,
        trello_card_url = NULL,
        trello_status = 'pending',
        trello_error = NULL
    OUTPUT
      inserted.id, inserted.session_id, inserted.title, inserted.objective, inserted.preconditions, inserted.test_steps_json,
      inserted.expected_result, inserted.priority, inserted.list_type, inserted.trello_card_id, inserted.trello_card_url,
      inserted.trello_status, inserted.trello_error, inserted.created_at
    WHERE id = $1 AND session_id = $2
    `,
    [cardId, sessionId, title, expectedResult, JSON.stringify(parsedSteps), priority, listType]
  );

  await query(
    `
    UPDATE project_sessions
    SET status = 'preview_ready',
        error_message = NULL,
        updated_at = SYSUTCDATETIME()
    WHERE id = $1
    `,
    [sessionId]
  );

  res.json({
    card: toApiPreviewCard(updatedCard.rows[0]),
    sessionStatus: "preview_ready",
  });
});

projectRouter.post("/sessions/:sessionId/send-to-trello", async (req, res) => {
  if (!isTrelloConfigured()) {
    res.status(400).json({ message: "Trello QA list variables are not fully configured." });
    return;
  }

  const { sessionId } = req.params;
  const userId = req.authUser!.userId;

  const session = await getSessionOwnedByUser(sessionId, userId);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }

  const pendingCards = await query<SessionPreviewCardRow>(
    `
    SELECT
      id, session_id, title, objective, preconditions, test_steps_json, expected_result,
      priority, list_type, trello_card_id, trello_card_url, trello_status, trello_error, created_at
    FROM session_preview_cards
    WHERE session_id = $1 AND trello_status <> 'sent'
    ORDER BY created_at ASC
    `,
    [sessionId]
  );

  const trelloSync = await syncSessionPreviewCardsToTrello(pendingCards.rows);

  const remaining = await query<{ missing_count: number }>(
    `
    SELECT COUNT(1) AS missing_count
    FROM session_preview_cards
    WHERE session_id = $1 AND trello_status <> 'sent'
    `,
    [sessionId]
  );

  const missingCount = Number(remaining.rows[0]?.missing_count ?? 0);
  const sessionStatus: ProjectSessionStatus = missingCount > 0 ? "partial" : "synced";

  await query(
    `
    UPDATE project_sessions
    SET status = $2,
        error_message = NULL,
        updated_at = SYSUTCDATETIME()
    WHERE id = $1
    `,
    [sessionId, sessionStatus]
  );

  const refreshedSession = await getSessionOwnedByUser(sessionId, userId);
  const previewCards = await getSessionPreviewCards(sessionId);

  res.json({
    session: {
      id: refreshedSession!.id,
      projectId: refreshedSession!.project_id,
      createdByUserId: refreshedSession!.created_by_user_id,
      name: refreshedSession!.name,
      iconName: refreshedSession!.icon_name,
      sourceInput: refreshedSession!.source_input,
      status: refreshedSession!.status,
      aiModel: refreshedSession!.ai_model,
      errorMessage: refreshedSession!.error_message,
      createdAt: refreshedSession!.created_at,
      updatedAt: refreshedSession!.updated_at,
      previewCards: previewCards.map((card) => toApiPreviewCard(card)),
    },
    trelloSync,
  });
});

projectRouter.get("/prompt-templates/system", requireAdmin, async (req, res) => {
  const userId = req.authUser!.userId;
  const template = await getUserSystemPrompt(userId);

  res.json({
    template: {
      templateKey: promptTemplateKey,
      title: template.title,
      content: template.content,
      updatedAt: template.updatedAt,
      source: template.source,
    },
  });
});

projectRouter.put("/prompt-templates/system", requireAdmin, async (req, res) => {
  const userId = req.authUser!.userId;
  const { content, title } = req.body as { content?: string; title?: string };

  const cleanContent = String(content ?? "").trim();
  if (!cleanContent) {
    res.status(400).json({ message: "Prompt content is required." });
    return;
  }

  const saved = await upsertUserSystemPrompt(
    userId,
    cleanContent,
    String(title ?? "System Prompt").trim() || "System Prompt"
  );

  res.json({
    template: {
      id: saved.id,
      templateKey: saved.template_key,
      title: saved.title,
      content: saved.content,
      updatedAt: saved.updated_at,
      source: "db",
    },
  });
});
