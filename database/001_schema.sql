IF DB_ID('dwsaimanagement') IS NULL
BEGIN
  CREATE DATABASE [dwsaimanagement];
END
GO

USE [dwsaimanagement];
GO

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_users PRIMARY KEY
      CONSTRAINT DF_users_id DEFAULT NEWID(),
    username NVARCHAR(80) NOT NULL,
    email_encrypted NVARCHAR(400) NOT NULL,
    password_sha256 CHAR(64) NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_users_username ON dbo.users(username);
  CREATE UNIQUE INDEX UX_users_email_encrypted ON dbo.users(email_encrypted);
END
GO

IF OBJECT_ID('dbo.projects', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.projects (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_projects PRIMARY KEY
      CONSTRAINT DF_projects_id DEFAULT NEWID(),
    owner_user_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(140) NOT NULL,
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_projects_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_projects_owner_user
      FOREIGN KEY (owner_user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
  );
END
GO

IF COL_LENGTH('dbo.projects', 'icon_name') IS NULL
BEGIN
  ALTER TABLE dbo.projects
  ADD icon_name NVARCHAR(40) NOT NULL CONSTRAINT DF_projects_icon_name DEFAULT 'folder';
END
GO

IF OBJECT_ID('dbo.qa_generation_runs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.qa_generation_runs (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_qa_generation_runs PRIMARY KEY
      CONSTRAINT DF_qa_generation_runs_id DEFAULT NEWID(),
    project_id UNIQUEIDENTIFIER NOT NULL,
    created_by_user_id UNIQUEIDENTIFIER NOT NULL,
    source_type NVARCHAR(20) NOT NULL CONSTRAINT DF_qa_generation_runs_source_type DEFAULT 'qa_input',
    raw_input NVARCHAR(MAX) NOT NULL,
    ai_model NVARCHAR(120) NULL,
    ai_raw_response NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_qa_generation_runs_status DEFAULT 'pending',
    error_message NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_qa_generation_runs_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_qa_generation_runs_source_type CHECK (source_type IN ('qa_input')),
    CONSTRAINT CK_qa_generation_runs_status CHECK (status IN ('pending', 'completed', 'partial', 'error')),
    CONSTRAINT FK_qa_generation_runs_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE,
    CONSTRAINT FK_qa_generation_runs_created_by
      FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END
GO

IF OBJECT_ID('dbo.qa_use_cases', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.qa_use_cases (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_qa_use_cases PRIMARY KEY
      CONSTRAINT DF_qa_use_cases_id DEFAULT NEWID(),
    run_id UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(220) NOT NULL,
    objective NVARCHAR(MAX) NOT NULL,
    preconditions NVARCHAR(MAX) NOT NULL CONSTRAINT DF_qa_use_cases_preconditions DEFAULT '',
    test_steps_json NVARCHAR(MAX) NOT NULL,
    expected_result NVARCHAR(MAX) NOT NULL,
    priority NVARCHAR(10) NOT NULL,
    test_type NVARCHAR(20) NOT NULL,
    trello_card_id NVARCHAR(120) NULL,
    trello_card_url NVARCHAR(500) NULL,
    trello_status NVARCHAR(20) NOT NULL CONSTRAINT DF_qa_use_cases_trello_status DEFAULT 'pending',
    trello_error NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_qa_use_cases_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_qa_use_cases_priority CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT CK_qa_use_cases_test_type CHECK (test_type IN ('functional', 'negative', 'edge', 'regression')),
    CONSTRAINT CK_qa_use_cases_trello_status CHECK (trello_status IN ('pending', 'sent', 'failed')),
    CONSTRAINT CK_qa_use_cases_steps_json CHECK (ISJSON(test_steps_json) = 1),
    CONSTRAINT FK_qa_use_cases_run
      FOREIGN KEY (run_id) REFERENCES dbo.qa_generation_runs(id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.project_sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.project_sessions (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_project_sessions PRIMARY KEY
      CONSTRAINT DF_project_sessions_id DEFAULT NEWID(),
    project_id UNIQUEIDENTIFIER NOT NULL,
    created_by_user_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(220) NOT NULL,
    icon_name NVARCHAR(40) NOT NULL CONSTRAINT DF_project_sessions_icon_name DEFAULT 'folder',
    source_input NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_project_sessions_status DEFAULT 'draft',
    ai_model NVARCHAR(120) NULL,
    ai_raw_response NVARCHAR(MAX) NULL,
    error_message NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_project_sessions_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_project_sessions_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_project_sessions_status CHECK (status IN ('draft', 'preview_ready', 'synced', 'partial', 'error')),
    CONSTRAINT FK_project_sessions_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects(id) ON DELETE CASCADE,
    CONSTRAINT FK_project_sessions_created_by
      FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END
GO

IF OBJECT_ID('dbo.session_preview_cards', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.session_preview_cards (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_session_preview_cards PRIMARY KEY
      CONSTRAINT DF_session_preview_cards_id DEFAULT NEWID(),
    session_id UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(220) NOT NULL,
    objective NVARCHAR(MAX) NOT NULL,
    preconditions NVARCHAR(MAX) NOT NULL CONSTRAINT DF_session_preview_cards_preconditions DEFAULT '',
    test_steps_json NVARCHAR(MAX) NOT NULL,
    expected_result NVARCHAR(MAX) NOT NULL,
    priority NVARCHAR(10) NOT NULL,
    list_type NVARCHAR(20) NOT NULL,
    trello_card_id NVARCHAR(120) NULL,
    trello_card_url NVARCHAR(500) NULL,
    trello_status NVARCHAR(20) NOT NULL CONSTRAINT DF_session_preview_cards_trello_status DEFAULT 'pending',
    trello_error NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_session_preview_cards_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_session_preview_cards_priority CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT CK_session_preview_cards_list_type CHECK (list_type IN ('functional', 'negative', 'edge', 'regression')),
    CONSTRAINT CK_session_preview_cards_trello_status CHECK (trello_status IN ('pending', 'sent', 'failed')),
    CONSTRAINT CK_session_preview_cards_steps_json CHECK (ISJSON(test_steps_json) = 1),
    CONSTRAINT FK_session_preview_cards_session
      FOREIGN KEY (session_id) REFERENCES dbo.project_sessions(id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.prompt_templates', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.prompt_templates (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_prompt_templates PRIMARY KEY
      CONSTRAINT DF_prompt_templates_id DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    template_key NVARCHAR(60) NOT NULL,
    title NVARCHAR(120) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_prompt_templates_is_active DEFAULT 1,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_prompt_templates_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_prompt_templates_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_prompt_templates_user
      FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.projects', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_projects_owner_user_id' AND object_id = OBJECT_ID('dbo.projects'))
BEGIN
  CREATE INDEX IX_projects_owner_user_id ON dbo.projects(owner_user_id);
END
GO

IF OBJECT_ID('dbo.projects', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_projects_icon_name' AND object_id = OBJECT_ID('dbo.projects'))
BEGIN
  CREATE INDEX IX_projects_icon_name ON dbo.projects(icon_name);
END
GO

IF OBJECT_ID('dbo.qa_generation_runs', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qa_generation_runs_project_id' AND object_id = OBJECT_ID('dbo.qa_generation_runs'))
BEGIN
  CREATE INDEX IX_qa_generation_runs_project_id ON dbo.qa_generation_runs(project_id);
END
GO

IF OBJECT_ID('dbo.qa_generation_runs', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qa_generation_runs_created_by_user_id' AND object_id = OBJECT_ID('dbo.qa_generation_runs'))
BEGIN
  CREATE INDEX IX_qa_generation_runs_created_by_user_id ON dbo.qa_generation_runs(created_by_user_id);
END
GO

IF OBJECT_ID('dbo.qa_use_cases', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qa_use_cases_run_id' AND object_id = OBJECT_ID('dbo.qa_use_cases'))
BEGIN
  CREATE INDEX IX_qa_use_cases_run_id ON dbo.qa_use_cases(run_id);
END
GO

IF OBJECT_ID('dbo.qa_use_cases', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qa_use_cases_trello_status' AND object_id = OBJECT_ID('dbo.qa_use_cases'))
BEGIN
  CREATE INDEX IX_qa_use_cases_trello_status ON dbo.qa_use_cases(trello_status);
END
GO

IF OBJECT_ID('dbo.project_sessions', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_project_sessions_project_id' AND object_id = OBJECT_ID('dbo.project_sessions'))
BEGIN
  CREATE INDEX IX_project_sessions_project_id ON dbo.project_sessions(project_id);
END
GO

IF OBJECT_ID('dbo.project_sessions', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_project_sessions_created_by_user_id' AND object_id = OBJECT_ID('dbo.project_sessions'))
BEGIN
  CREATE INDEX IX_project_sessions_created_by_user_id ON dbo.project_sessions(created_by_user_id);
END
GO

IF OBJECT_ID('dbo.project_sessions', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_project_sessions_status' AND object_id = OBJECT_ID('dbo.project_sessions'))
BEGIN
  CREATE INDEX IX_project_sessions_status ON dbo.project_sessions(status);
END
GO

IF OBJECT_ID('dbo.session_preview_cards', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_session_preview_cards_session_id' AND object_id = OBJECT_ID('dbo.session_preview_cards'))
BEGIN
  CREATE INDEX IX_session_preview_cards_session_id ON dbo.session_preview_cards(session_id);
END
GO

IF OBJECT_ID('dbo.session_preview_cards', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_session_preview_cards_trello_status' AND object_id = OBJECT_ID('dbo.session_preview_cards'))
BEGIN
  CREATE INDEX IX_session_preview_cards_trello_status ON dbo.session_preview_cards(trello_status);
END
GO

IF OBJECT_ID('dbo.prompt_templates', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_prompt_templates_user_template_key' AND object_id = OBJECT_ID('dbo.prompt_templates'))
BEGIN
  CREATE UNIQUE INDEX UX_prompt_templates_user_template_key ON dbo.prompt_templates(user_id, template_key);
END
GO

IF OBJECT_ID('dbo.prompt_templates', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_prompt_templates_user_id' AND object_id = OBJECT_ID('dbo.prompt_templates'))
BEGIN
  CREATE INDEX IX_prompt_templates_user_id ON dbo.prompt_templates(user_id);
END
GO
