USE [dwsaimanagement];
GO

IF OBJECT_ID('dbo.roles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.roles (
    role_key NVARCHAR(20) NOT NULL
      CONSTRAINT PK_roles PRIMARY KEY,
    role_name NVARCHAR(80) NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_roles_created_at DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.permissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.permissions (
    permission_key NVARCHAR(80) NOT NULL
      CONSTRAINT PK_permissions PRIMARY KEY,
    description NVARCHAR(220) NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_permissions_created_at DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.role_permissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.role_permissions (
    role_key NVARCHAR(20) NOT NULL,
    permission_key NVARCHAR(80) NOT NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_role_permissions_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_role_permissions PRIMARY KEY (role_key, permission_key),
    CONSTRAINT FK_role_permissions_role
      FOREIGN KEY (role_key) REFERENCES dbo.roles(role_key) ON DELETE CASCADE,
    CONSTRAINT FK_role_permissions_permission
      FOREIGN KEY (permission_key) REFERENCES dbo.permissions(permission_key) ON DELETE CASCADE
  );
END
GO

MERGE dbo.roles AS target
USING (
  SELECT N'admin' AS role_key, N'Administrator' AS role_name
  UNION ALL
  SELECT N'user', N'User'
) AS source
ON target.role_key = source.role_key
WHEN MATCHED THEN
  UPDATE SET role_name = source.role_name
WHEN NOT MATCHED THEN
  INSERT (role_key, role_name)
  VALUES (source.role_key, source.role_name);
GO

MERGE dbo.permissions AS target
USING (
  SELECT N'prompt_panel:read' AS permission_key, N'Can read prompt panel templates' AS description
  UNION ALL
  SELECT N'prompt_panel:write', N'Can update prompt panel templates'
  UNION ALL
  SELECT N'users:manage', N'Can create and edit users'
) AS source
ON target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET description = source.description
WHEN NOT MATCHED THEN
  INSERT (permission_key, description)
  VALUES (source.permission_key, source.description);
GO

MERGE dbo.role_permissions AS target
USING (
  SELECT N'admin' AS role_key, N'prompt_panel:read' AS permission_key
  UNION ALL
  SELECT N'admin', N'prompt_panel:write'
  UNION ALL
  SELECT N'admin', N'users:manage'
) AS source
ON target.role_key = source.role_key
   AND target.permission_key = source.permission_key
WHEN NOT MATCHED THEN
  INSERT (role_key, permission_key)
  VALUES (source.role_key, source.permission_key);
GO

IF COL_LENGTH('dbo.users', 'role_key') IS NULL
BEGIN
  ALTER TABLE dbo.users
  ADD role_key NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.users', 'role_key') IS NOT NULL
BEGIN
  -- Preserve current access for existing rows after introducing RBAC.
  EXEC(N'
    UPDATE dbo.users
    SET role_key = N''admin''
    WHERE role_key IS NULL;
  ');
END
GO

IF COL_LENGTH('dbo.users', 'role_key') IS NOT NULL
BEGIN
  EXEC(N'
    UPDATE dbo.users
    SET role_key = N''user''
    WHERE role_key NOT IN (N''admin'', N''user'');
  ');
END
GO

IF COL_LENGTH('dbo.users', 'role_key') IS NOT NULL
  AND OBJECT_ID('DF_users_role_key', 'D') IS NULL
BEGIN
  EXEC(N'
    ALTER TABLE dbo.users
    ADD CONSTRAINT DF_users_role_key DEFAULT N''user'' FOR role_key;
  ');
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.users')
    AND name = 'role_key'
    AND is_nullable = 1
)
BEGIN
  EXEC(N'
    ALTER TABLE dbo.users
    ALTER COLUMN role_key NVARCHAR(20) NOT NULL;
  ');
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys fk
  INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.users')
    AND fk.referenced_object_id = OBJECT_ID('dbo.roles')
    AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'role_key'
)
BEGIN
  EXEC(N'
    ALTER TABLE dbo.users WITH CHECK
    ADD CONSTRAINT FK_users_role_key
      FOREIGN KEY (role_key) REFERENCES dbo.roles(role_key);
  ');
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
  AND COL_LENGTH('dbo.users', 'role_key') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_role_key' AND object_id = OBJECT_ID('dbo.users'))
BEGIN
  EXEC(N'CREATE INDEX IX_users_role_key ON dbo.users(role_key);');
END
GO
