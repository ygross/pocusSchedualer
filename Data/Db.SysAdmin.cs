using Dapper;

public sealed partial class Db
{
    public async Task EnsureSysAdminSeedAsync()
    {
        const string sql = @"
UPDATE dbo.Instructors
SET    [Role] = 'SystemAdmin', [Status] = 'active'
WHERE  Email = 'ygross@bgu.ac.il';";
        await using var c = Open();
        await c.ExecuteAsync(sql);
    }

    public async Task RunMigrationsAsync()
    {
        const string sql = @"
-- ── Existing columns ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.Courses') AND name='DefaultLeadInstructorId')
    ALTER TABLE dbo.Courses ADD DefaultLeadInstructorId INT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.ActivityInstances') AND name='Location')
    ALTER TABLE dbo.ActivityInstances ADD Location NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.ActivityInstances') AND name='Notes')
    ALTER TABLE dbo.ActivityInstances ADD Notes NVARCHAR(1000) NULL;

-- ── Feature: Automatic Reminders ─────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='ReminderLog')
BEGIN
    CREATE TABLE dbo.ReminderLog(
        LogId        BIGINT IDENTITY PRIMARY KEY,
        InstanceId   INT NOT NULL,
        InstructorId INT NOT NULL,
        DaysBefore   INT NOT NULL,
        Channel      NVARCHAR(20) NOT NULL,
        SentAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Status       NVARCHAR(20) NOT NULL DEFAULT 'Sent',
        FailReason   NVARCHAR(500) NULL
    );
    CREATE UNIQUE INDEX UX_ReminderLog
        ON dbo.ReminderLog(InstanceId, InstructorId, DaysBefore, Channel);
END

-- ── Feature: Checklists ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='Checklists')
    CREATE TABLE dbo.Checklists(
        ChecklistId  INT IDENTITY PRIMARY KEY,
        Title        NVARCHAR(200) NOT NULL,
        Description  NVARCHAR(1000) NULL,
        CreatedById  INT NULL,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='ChecklistItems')
    CREATE TABLE dbo.ChecklistItems(
        ItemId       INT IDENTITY PRIMARY KEY,
        ChecklistId  INT NOT NULL,
        ItemText     NVARCHAR(500) NOT NULL,
        SortOrder    INT NOT NULL DEFAULT 0,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='ChecklistCourseLinks')
BEGIN
    CREATE TABLE dbo.ChecklistCourseLinks(
        LinkId       INT IDENTITY PRIMARY KEY,
        ChecklistId  INT NOT NULL,
        CourseId     INT NOT NULL,
        LinkedById   INT NULL,
        LinkedAtUtc  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX UX_ChecklistCourseLinks
        ON dbo.ChecklistCourseLinks(ChecklistId, CourseId);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='ChecklistProgress')
BEGIN
    CREATE TABLE dbo.ChecklistProgress(
        ProgressId   INT IDENTITY PRIMARY KEY,
        LinkId       INT NOT NULL,
        ItemId       INT NOT NULL,
        IsChecked    BIT NOT NULL DEFAULT 0,
        CheckedById  INT NULL,
        CheckedAtUtc DATETIME2 NULL,
        UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX UX_ChecklistProgress
        ON dbo.ChecklistProgress(LinkId, ItemId);
END";
        await using var c = Open();
        await c.ExecuteAsync(sql);
    }

    public async Task<SysAdminDashboardDto> GetSysAdminDashboardAsync()
    {
        const string sql = @"
SELECT
  (SELECT COUNT(*) FROM dbo.Instructors WHERE [Status] IN ('active','approved'))           AS ActiveInstructors,
  (SELECT COUNT(*) FROM dbo.Instructors WHERE [Role] = 'SystemAdmin')                     AS SysAdminCount,
  (SELECT COUNT(*) FROM dbo.EmailOutbox  WHERE CreatedAtUtc >= CAST(GETUTCDATE() AS DATE) AND Status = 'Sent')   AS EmailsSentToday,
  (SELECT COUNT(*) FROM dbo.EmailOutbox  WHERE CreatedAtUtc >= CAST(GETUTCDATE() AS DATE) AND Status = 'Failed') AS EmailsFailedToday,
  (SELECT COUNT(*) FROM dbo.AuditLog     WHERE CreatedAtUtc >= CAST(GETUTCDATE() AS DATE))                       AS AuditActionsToday,
  SYSUTCDATETIME() AS DbTimeUtc;";
        await using var c = Open();
        return await c.QuerySingleAsync<SysAdminDashboardDto>(sql);
    }

    public async Task<List<SysAdminEmailDto>> GetSysAdminEmailsAsync(string? status, int days)
    {
        const string sql = @"
SELECT TOP 300
  EmailId, ToEmail, Subject, RelatedEntity, RelatedId,
  Status, FailReason, CreatedAtUtc, SentAtUtc
FROM dbo.EmailOutbox
WHERE CreatedAtUtc >= DATEADD(DAY, -@Days, SYSUTCDATETIME())
  AND (@Status IS NULL OR Status = @Status)
ORDER BY EmailId DESC;";
        await using var c = Open();
        var rows = await c.QueryAsync<SysAdminEmailDto>(sql, new { Days = days, Status = status });
        return rows.ToList();
    }

    public async Task<bool> ResendEmailAsync(long emailId)
    {
        const string sql = @"
UPDATE dbo.EmailOutbox
SET Status = 'Queued', FailReason = NULL, SentAtUtc = NULL
WHERE EmailId = @EmailId AND Status = 'Failed';";
        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new { EmailId = emailId });
        return rows > 0;
    }

    public async Task<List<SysAdminAuditRowDto>> GetSysAdminAuditAsync(int days, string? entity, string? action, int? actorId)
    {
        const string sql = @"
SELECT TOP 300
  al.LogId, al.ActorInstructorId,
  ISNULL(i.FullName, CAST(al.ActorInstructorId AS NVARCHAR(20))) AS ActorName,
  al.Action, al.Entity, al.EntityId, al.DetailsJson,
  al.Ip, al.CorrelationId, al.CreatedAtUtc
FROM dbo.AuditLog al
LEFT JOIN dbo.Instructors i ON i.InstructorId = al.ActorInstructorId
WHERE al.CreatedAtUtc >= DATEADD(DAY, -@Days, SYSUTCDATETIME())
  AND (@Entity  IS NULL OR al.Entity  = @Entity)
  AND (@Action  IS NULL OR al.Action  = @Action)
  AND (@ActorId IS NULL OR al.ActorInstructorId = @ActorId)
ORDER BY al.LogId DESC;";
        await using var c = Open();
        var rows = await c.QueryAsync<SysAdminAuditRowDto>(sql,
            new { Days = days, Entity = entity, Action = action, ActorId = actorId });
        return rows.ToList();
    }

    public async Task<SysAdminErrorsDto> GetSysAdminErrorsAsync(int days)
    {
        const string emailsSql = @"
SELECT TOP 100
  LogId, EmailId, ToEmail, Subject, Status, FailReason, Provider, AttemptNo, CreatedAtUtc
FROM dbo.EmailSendLog
WHERE CreatedAtUtc >= DATEADD(DAY, -@Days, SYSUTCDATETIME())
  AND Status = 'Failed'
ORDER BY LogId DESC;";

        const string otpSql = @"
SELECT TOP 50
  OtpId, Email, Attempts, MaxAttempts, IsUsed, ExpiresAtUtc, CreatedAtUtc
FROM dbo.OtpCodes
WHERE CreatedAtUtc >= DATEADD(DAY, -@Days, SYSUTCDATETIME())
  AND Attempts >= MaxAttempts AND IsUsed = 0
ORDER BY OtpId DESC;";

        await using var c = Open();
        var failedEmails = (await c.QueryAsync<SysAdminFailedSendDto>(emailsSql, new { Days = days })).ToList();
        var exhaustedOtps = (await c.QueryAsync<SysAdminExhaustedOtpDto>(otpSql, new { Days = days })).ToList();
        return new SysAdminErrorsDto { FailedEmails = failedEmails, ExhaustedOtps = exhaustedOtps };
    }

    public async Task<int> ClearOldOtpsAsync(int olderThanDays)
    {
        const string sql = @"
DELETE FROM dbo.OtpCodes
WHERE (IsUsed = 1 OR ExpiresAtUtc < SYSUTCDATETIME())
  AND CreatedAtUtc < DATEADD(DAY, -@Days, SYSUTCDATETIME());";
        await using var c = Open();
        return await c.ExecuteAsync(sql, new { Days = olderThanDays });
    }

    public async Task<List<SysAdminInstructorRowDto>> GetSysAdminInstructorsAsync(string? role, string? status)
    {
        const string sql = @"
SELECT TOP 300
  InstructorId, FullName, Email,
  [Role] AS RoleName, [Status] AS Status,
  Department, CreatedAtUtc
FROM dbo.Instructors
WHERE (@Role   IS NULL OR [Role]   = @Role)
  AND (@Status IS NULL OR [Status] = @Status)
ORDER BY InstructorId DESC;";
        await using var c = Open();
        var rows = await c.QueryAsync<SysAdminInstructorRowDto>(sql, new { Role = role, Status = status });
        return rows.ToList();
    }

    public async Task<bool> SetInstructorRoleStatusAsync(int instructorId, string role, string status)
    {
        const string sql = @"
UPDATE dbo.Instructors
SET [Role] = @Role, [Status] = @Status
WHERE InstructorId = @InstructorId;";
        await using var c = Open();
        return await c.ExecuteAsync(sql, new { InstructorId = instructorId, Role = role, Status = status }) > 0;
    }

    public async Task<SysCourseForceDeleteResultDto> ForceDeleteCourseAsync(int courseId)
    {
        const string countSql = @"
SELECT
    (SELECT COUNT(1) FROM dbo.Activities WHERE CourseId = @courseId) AS ActivitiesCount,
    (SELECT COUNT(1) FROM dbo.ActivityInstances WHERE ActivityId IN
        (SELECT ActivityId FROM dbo.Activities WHERE CourseId = @courseId)) AS InstancesCount,
    (SELECT COUNT(1) FROM dbo.Assignments WHERE InstanceId IN
        (SELECT inst.InstanceId FROM dbo.ActivityInstances inst
         INNER JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
         WHERE a.CourseId = @courseId)) AS AssignmentsCount,
    (SELECT COUNT(1) FROM dbo.InstructorCourses WHERE CourseId = @courseId) AS InstructorLinksCount;";

        await using var c = Open();

        var exists = await c.QuerySingleAsync<int>(
            "SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.Courses WHERE CourseId=@courseId) THEN 1 ELSE 0 END;",
            new { courseId });
        if (exists == 0)
            return new SysCourseForceDeleteResultDto { Ok = false, Error = "CourseNotFound" };

        var counts = await c.QuerySingleAsync<SysCourseForceDeleteResultDto>(countSql, new { courseId });

        using var tx = c.BeginTransaction();
        try
        {
            await c.ExecuteAsync(@"
DELETE FROM dbo.AvailabilityRequests WHERE InstanceId IN (
    SELECT inst.InstanceId FROM dbo.ActivityInstances inst
    INNER JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE a.CourseId = @courseId);", new { courseId }, tx);

            await c.ExecuteAsync(@"
DELETE FROM dbo.Assignments WHERE InstanceId IN (
    SELECT inst.InstanceId FROM dbo.ActivityInstances inst
    INNER JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE a.CourseId = @courseId);", new { courseId }, tx);

            await c.ExecuteAsync(@"
DELETE FROM dbo.ActivityInstances WHERE ActivityId IN
    (SELECT ActivityId FROM dbo.Activities WHERE CourseId = @courseId);", new { courseId }, tx);

            await c.ExecuteAsync("DELETE FROM dbo.Activities      WHERE CourseId = @courseId;", new { courseId }, tx);
            await c.ExecuteAsync("DELETE FROM dbo.InstructorCourses WHERE CourseId = @courseId;", new { courseId }, tx);
            await c.ExecuteAsync("DELETE FROM dbo.Courses          WHERE CourseId = @courseId;", new { courseId }, tx);

            tx.Commit();
            counts.Ok = true;
            return counts;
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return new SysCourseForceDeleteResultDto { Ok = false, Error = ex.Message };
        }
    }

    public async Task<SysPurgeLogsResultDto> PurgeLogsAsync(int olderThanDays)
    {
        var cutoff = DateTime.UtcNow.AddDays(-olderThanDays);
        await using var c = Open();

        var emailSendLog = await c.ExecuteAsync(
            "DELETE FROM dbo.EmailSendLog WHERE CreatedAtUtc < @cutoff;", new { cutoff });
        var emailOutbox = await c.ExecuteAsync(
            "DELETE FROM dbo.EmailOutbox WHERE CreatedAtUtc < @cutoff AND Status IN ('Sent','Failed','Cancelled');",
            new { cutoff });
        var auditLog = await c.ExecuteAsync(
            "DELETE FROM dbo.AuditLog WHERE CreatedAtUtc < @cutoff;", new { cutoff });

        return new SysPurgeLogsResultDto
        {
            EmailSendLogDeleted = emailSendLog,
            EmailOutboxDeleted  = emailOutbox,
            AuditLogDeleted     = auditLog,
            OlderThanDays       = olderThanDays
        };
    }
}

public class SysAdminDashboardDto
{
    public int ActiveInstructors { get; set; }
    public int SysAdminCount { get; set; }
    public int EmailsSentToday { get; set; }
    public int EmailsFailedToday { get; set; }
    public int AuditActionsToday { get; set; }
    public DateTime DbTimeUtc { get; set; }
}

public class SysAdminEmailDto
{
    public long EmailId { get; set; }
    public string ToEmail { get; set; } = "";
    public string Subject { get; set; } = "";
    public string? RelatedEntity { get; set; }
    public string? RelatedId { get; set; }
    public string Status { get; set; } = "";
    public string? FailReason { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
}

public class SysAdminAuditRowDto
{
    public long LogId { get; set; }
    public int? ActorInstructorId { get; set; }
    public string? ActorName { get; set; }
    public string Action { get; set; } = "";
    public string? Entity { get; set; }
    public string? EntityId { get; set; }
    public string? DetailsJson { get; set; }
    public string? Ip { get; set; }
    public string? CorrelationId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class SysAdminFailedSendDto
{
    public long LogId { get; set; }
    public long? EmailId { get; set; }
    public string ToEmail { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Status { get; set; } = "";
    public string? FailReason { get; set; }
    public string Provider { get; set; } = "";
    public int AttemptNo { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class SysAdminExhaustedOtpDto
{
    public long OtpId { get; set; }
    public string Email { get; set; } = "";
    public int Attempts { get; set; }
    public int MaxAttempts { get; set; }
    public bool IsUsed { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class SysAdminErrorsDto
{
    public List<SysAdminFailedSendDto> FailedEmails { get; set; } = new();
    public List<SysAdminExhaustedOtpDto> ExhaustedOtps { get; set; } = new();
}

public class SysAdminInstructorRowDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string RoleName { get; set; } = "";
    public string Status { get; set; } = "";
    public string? Department { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
}

public class SysCourseForceDeleteResultDto
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public int ActivitiesCount { get; set; }
    public int InstancesCount { get; set; }
    public int AssignmentsCount { get; set; }
    public int InstructorLinksCount { get; set; }
}

public class SysPurgeLogsResultDto
{
    public int EmailSendLogDeleted { get; set; }
    public int EmailOutboxDeleted { get; set; }
    public int AuditLogDeleted { get; set; }
    public int OlderThanDays { get; set; }
}
