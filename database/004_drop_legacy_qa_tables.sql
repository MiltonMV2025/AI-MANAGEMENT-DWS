USE [dwsaimanagement];
GO

IF OBJECT_ID('dbo.qa_use_cases', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.qa_use_cases;
END
GO

IF OBJECT_ID('dbo.qa_generation_runs', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.qa_generation_runs;
END
GO
