using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;

public sealed class Db
{
    private readonly IConfiguration _cfg;
    public Db(IConfiguration cfg) => _cfg = cfg;

    private string ConnString =>
        _cfg.GetConnectionString("PocusSchedualer")
        ?? _cfg.GetConnectionString("SimLoanDb")
        ?? _cfg.GetConnectionString("DefaultConnection")
        ?? throw new Exception("Missing connection string (PocusSchedualer / SimLoanDb / DefaultConnection)");

    private SqlConnection NewConnection()
    {
        var c = new SqlConnection(ConnString);
        c.Open();
        return c;
    }

    public SqlConnection Open() => NewConnection();

    // ✅ DB Health (לנקודה /health/db)
public async Task<bool> IsDbAliveAsync()
{
    await using var c = Open();
    var x = await c.QuerySingleAsync<int>("SELECT 1;");
    return x == 1;
}
 

// ================= OTP =================

public async Task<long> CreateOtpAsync(
    string email,
    byte[] hash,
    byte[] salt,
    DateTime expiresUtc,
    string? ip,
    string? ua,
    int maxAttempts)
{
    const string sql = @"
INSERT INTO dbo.OtpCodes
(Email, CodeHash, Salt, CreatedAtUtc, ExpiresAtUtc, Attempts, MaxAttempts, IsUsed, RequestIp, UserAgent)
OUTPUT INSERTED.OtpId
VALUES
(@Email, @Hash, @Salt, SYSUTCDATETIME(), @ExpiresAtUtc, 0, @MaxAttempts, 0, @Ip, @Ua);";

    await using var c = Open();
    return await c.QuerySingleAsync<long>(sql, new {
        Email = email,
        Hash = hash,
        Salt = salt,
        ExpiresAtUtc = expiresUtc,
        MaxAttempts = maxAttempts,
        Ip = ip,
        Ua = ua
    });
}

public async Task<(byte[] Hash, byte[] Salt, int Attempts, int MaxAttempts, bool IsUsed, DateTime Expires)?>
    GetLatestOtpAsync(string email)
{
    const string sql = @"
SELECT TOP 1
  CodeHash   AS Hash,
  Salt,
  Attempts,
  MaxAttempts,
  IsUsed,
  ExpiresAtUtc AS Expires
FROM dbo.OtpCodes
WHERE Email = @Email
ORDER BY OtpId DESC;";

    await using var c = Open();
    return await c.QueryFirstOrDefaultAsync<
        (byte[] Hash, byte[] Salt, int Attempts, int MaxAttempts, bool IsUsed, DateTime Expires)
    >(sql, new { Email = email });
}

public async Task IncrementOtpAttemptsAsync(string email)
{
    const string sql = @"
UPDATE dbo.OtpCodes
SET Attempts = Attempts + 1
WHERE OtpId = (
    SELECT TOP 1 OtpId FROM dbo.OtpCodes
    WHERE Email = @Email ORDER BY OtpId DESC
);";
    await using var c = Open();
    await c.ExecuteAsync(sql, new { Email = email });
}

public async Task MarkOtpUsedAsync(string email)
{
    const string sql = @"
UPDATE dbo.OtpCodes
SET IsUsed = 1
WHERE OtpId = (
    SELECT TOP 1 OtpId FROM dbo.OtpCodes
    WHERE Email = @Email ORDER BY OtpId DESC
);";
    await using var c = Open();
    await c.ExecuteAsync(sql, new { Email = email });
}

// ===== helpers =====
public static string GenerateOtpCode() =>
    RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

public static byte[] GenerateSalt()
{
    var s = new byte[16];
    RandomNumberGenerator.Fill(s);
    return s;
}

public static byte[] HashOtp(string code, byte[] salt)
{
    using var sha = SHA256.Create();
    var c = Encoding.UTF8.GetBytes(code);
    var all = new byte[c.Length + salt.Length];
    Buffer.BlockCopy(c, 0, all, 0, c.Length);
    Buffer.BlockCopy(salt, 0, all, c.Length, salt.Length);
    return sha.ComputeHash(all);
}
// =======================
// AUDIT LOG (Extended columns)
// =======================
public async Task InsertAuditAsync(
    int? actorInstructorId,
    string action,
    string? entity,
    string? entityId,
    string? detailsJson,
    string? correlationId,
    string? ip,
    string? userAgent)
{
    const string sql = @"
INSERT INTO dbo.AuditLog
(ActorInstructorId, Action, Entity, EntityId, DetailsJson, CorrelationId, Ip, UserAgent, CreatedAtUtc)
VALUES
(@ActorInstructorId, @Action, @Entity, @EntityId, @DetailsJson, @CorrelationId, @Ip, @UserAgent, SYSUTCDATETIME());";

    await using var c = Open();
    await c.ExecuteAsync(sql, new
    {
        ActorInstructorId = actorInstructorId,
        Action = action,
        Entity = entity,
        EntityId = entityId,
        DetailsJson = detailsJson,
        CorrelationId = correlationId,
        Ip = ip,
        UserAgent = userAgent
    });
}

// =======================
// EMAIL OUTBOX STATUS UPDATES
// =======================
public async Task MarkEmailOutboxSentAsync(long emailId)
{
    const string sql = @"
UPDATE dbo.EmailOutbox
SET Status='Sent', SentAtUtc=SYSUTCDATETIME(), FailReason=NULL
WHERE EmailId=@EmailId;";

    await using var c = Open();
    await c.ExecuteAsync(sql, new { EmailId = emailId });
}

public async Task MarkEmailOutboxFailedAsync(long emailId, string failReason)
{
    const string sql = @"
UPDATE dbo.EmailOutbox
SET Status='Failed', FailReason=@FailReason
WHERE EmailId=@EmailId;";

    await using var c = Open();
    await c.ExecuteAsync(sql, new { EmailId = emailId, FailReason = failReason });
}

// =======================
// EMAIL SEND LOG (History / Attempts)
// =======================
public async Task<long> InsertEmailSendLogAsync(
    long? emailId,
    string toEmail,
    string subject,
    string? relatedEntity,
    string? relatedId,
    int attemptNo,
    string provider,
    string status,          // "Sent" / "Failed"
    string? failReason,
    int? actorInstructorId,
    string? correlationId,
    string? ip,
    string? userAgent)
{
    const string sql = @"
INSERT INTO dbo.EmailSendLog
(EmailId, ToEmail, Subject, RelatedEntity, RelatedId, AttemptNo, Provider, Status, FailReason,
 ActorInstructorId, CorrelationId, Ip, UserAgent, CreatedAtUtc)
OUTPUT INSERTED.LogId
VALUES
(@EmailId, @ToEmail, @Subject, @RelatedEntity, @RelatedId, @AttemptNo, @Provider, @Status, @FailReason,
 @ActorInstructorId, @CorrelationId, @Ip, @UserAgent, SYSUTCDATETIME());";

    await using var c = Open();
    return await c.QuerySingleAsync<long>(sql, new
    {
        EmailId = emailId,
        ToEmail = toEmail,
        Subject = subject,
        RelatedEntity = relatedEntity,
        RelatedId = relatedId,
        AttemptNo = attemptNo,
        Provider = provider,
        Status = status,
        FailReason = failReason,
        ActorInstructorId = actorInstructorId,
        CorrelationId = correlationId,
        Ip = ip,
        UserAgent = userAgent
    });
}

public async Task<long> EnqueueEmailAsync(string toEmail, string subject, string bodyHtml, string? relatedEntity, string? relatedId)
{
    const string sql = @"
INSERT INTO dbo.EmailOutbox
(ToEmail, Subject, BodyHtml, RelatedEntity, RelatedId, Status, CreatedAtUtc)
OUTPUT INSERTED.EmailId
VALUES
(@ToEmail, @Subject, @BodyHtml, @RelatedEntity, @RelatedId, 'Queued', SYSUTCDATETIME());";

    await using var c = Open();
    return await c.QuerySingleAsync<long>(sql, new
    {
        ToEmail = toEmail,
        Subject = subject,
        BodyHtml = bodyHtml,
        RelatedEntity = relatedEntity,
        RelatedId = relatedId
    });
}

// =======================
// Courses / Instructors (FULL LIST)
// =======================

public async Task<List<CourseDto>> GetCoursesAsync()
{
    const string sql = @"
        SELECT CourseId, CourseName, ActivityTypeId
        FROM dbo.Courses
        ORDER BY CourseName;";
    await using var c = Open();
    return (await c.QueryAsync<CourseDto>(sql)).AsList();
}

public async Task<List<InstructorDto>> GetInstructorsAsync()
{
    const string sql = @"
        SELECT InstructorId, FullName, Email
        FROM dbo.Instructors
        ORDER BY FullName;";
    await using var c = Open();
    return (await c.QueryAsync<InstructorDto>(sql)).AsList();
}

// =======================
// Course ↔ Instructor (CERTIFICATIONS)
// =======================

public async Task<List<int>> GetInstructorIdsForCourseAsync(int courseId)
{
    const string sql = @"
        SELECT InstructorId
        FROM dbo.InstructorCourses
        WHERE CourseId = @courseId;";
    await using var c = Open();
    return (await c.QueryAsync<int>(sql, new { courseId })).AsList();
}

public async Task SetCourseInstructorsAsync(int courseId, List<int> instructorIds)
{
    const string deleteSql = @"
        DELETE FROM dbo.InstructorCourses
        WHERE CourseId = @courseId;";

    const string insertSql = @"
        INSERT INTO dbo.InstructorCourses (CourseId, InstructorId)
        VALUES (@courseId, @instructorId);";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        await c.ExecuteAsync(deleteSql, new { courseId }, tx);

        foreach (var instructorId in instructorIds)
        {
            await c.ExecuteAsync(insertSql,
                new { courseId, instructorId },
                tx);
        }

        tx.Commit();
    }
    catch
    {
        tx.Rollback();
        throw;
    }
}

// ✅ Get Me (לנקודה /me)
public async Task<MeDto?> GetMeByEmailAsync(string email)
{
    const string sql = @"
SELECT TOP 1
  InstructorId,
  Email,
  FullName,
  [Role] AS RoleName,
  Department
FROM dbo.Instructors
WHERE Email = @email;";
    await using var c = Open();
    return await c.QueryFirstOrDefaultAsync<MeDto>(sql, new { email });
}

// ✅ Impersonate (לכפתור הזמני ב-Header)
public async Task<MeDto?> ImpersonateByEmailAsync(string email)
{
    // כרגע אותו דבר כמו GetMeByEmailAsync (אפשר להשאיר כ- wrapper)
    return await GetMeByEmailAsync(email);
}


    public async Task<DateTime> GetDbTimeAsync()
    {
        await using var c = NewConnection();
        return await c.QuerySingleAsync<DateTime>("SELECT GETDATE()");
    }
/*
    public async Task<(bool Ok, string? Error)> UpdateActivityHeaderAsync(int activityId, ActivityUpdateHeaderDto dto)
{
    if (string.IsNullOrWhiteSpace(dto.ActivityName))
        return (false, "ActivityName is required");
    if (dto.ActivityTypeId <= 0) return (false, "ActivityTypeId is required");
    if (dto.CourseId <= 0) return (false, "CourseId is required");
    if (dto.LeadInstructorId <= 0) return (false, "LeadInstructorId is required");

    const string sql = @"
UPDATE dbo.Activities
SET
  ActivityName = @ActivityName,
  ActivityTypeId = @ActivityTypeId,
  CourseId = @CourseId,
  LeadInstructorId = @LeadInstructorId,
  ApplicationDeadlineUtc = @ApplicationDeadlineUtc,
  UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @ActivityId;";

    await using var c = Open();
    var rows = await c.ExecuteAsync(sql, new
    {
        ActivityId = activityId,
        dto.ActivityName,
        dto.ActivityTypeId,
        dto.CourseId,
        dto.LeadInstructorId,
        dto.ApplicationDeadlineUtc
    });

    return rows > 0 ? (true, null) : (false, "NotFound");
}
*/
/*
public async Task<(bool Ok, string? Error, int InstanceId)> CreateActivityInstanceAsync(
    int activityId,
    ActivityInstanceEditDto dto)
{
    if (dto.StartUtc == default) return (false, "StartUtc is required", 0);
    if (dto.EndUtc == default) return (false, "EndUtc is required", 0);
    if (dto.EndUtc <= dto.StartUtc) return (false, "EndUtc must be after StartUtc", 0);

    const string sql = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors, IsCancelled, UpdatedAtUtc)
OUTPUT INSERTED.InstanceId
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors, 0, SYSUTCDATETIME());";

    await using var c = Open();

    try
    {
        var newId = await c.QuerySingleAsync<int>(sql, new
        {
            ActivityId = activityId,
            dto.StartUtc,
            dto.EndUtc,
            RoomsCount = dto.RoomsCount,
            RequiredInstructors = dto.RequiredInstructors
        });

        return (true, null, newId);
    }
    catch (Exception ex)
    {
        return (false, ex.Message, 0);
    }
} */
/*
public async Task<(bool Ok, string? Error)> UpdateActivityInstanceAsync(
    int instanceId,
    ActivityInstanceEditDto dto)
{
    if (dto.StartUtc == default) return (false, "StartUtc is required");
    if (dto.EndUtc == default) return (false, "EndUtc is required");
    if (dto.EndUtc <= dto.StartUtc) return (false, "EndUtc must be after StartUtc");

    const string sql = @"
UPDATE dbo.ActivityInstances
SET
  StartUtc = @StartUtc,
  EndUtc = @EndUtc,
  RoomsCount = @RoomsCount,
  RequiredInstructors = @RequiredInstructors,
  UpdatedAtUtc = SYSUTCDATETIME()
WHERE InstanceId = @InstanceId
  AND ISNULL(IsCancelled,0) = 0;";

    await using var c = Open();
    var rows = await c.ExecuteAsync(sql, new
    {
        InstanceId = instanceId,
        dto.StartUtc,
        dto.EndUtc,
        RoomsCount = dto.RoomsCount,
        RequiredInstructors = dto.RequiredInstructors
    });

    return rows > 0 ? (true, null) : (false, "NotFound");
}*/
/*
public async Task<(bool Ok, string? Error)> DeleteActivityAsync(int activityId)
{
    // מוחק: AvailabilityRequests + Assignments + ActivityInstances + Activities
    const string sqlExists = @"SELECT COUNT(1) FROM dbo.Activities WHERE ActivityId=@activityId;";

    const string sqlDeleteAvailability = @"
DELETE ar
FROM dbo.AvailabilityRequests ar
JOIN dbo.ActivityInstances inst ON inst.InstanceId = ar.InstanceId
WHERE inst.ActivityId = @activityId;";

    const string sqlDeleteAssignments = @"
DELETE ass
FROM dbo.Assignments ass
JOIN dbo.ActivityInstances inst ON inst.InstanceId = ass.InstanceId
WHERE inst.ActivityId = @activityId;";

    const string sqlDeleteInstances = @"
DELETE FROM dbo.ActivityInstances
WHERE ActivityId = @activityId;";

    const string sqlDeleteActivity = @"
DELETE FROM dbo.Activities
WHERE ActivityId = @activityId;";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { activityId }, tx);
        if (exists == 0)
        {
            tx.Rollback();
            return (false, "NotFound");
        }

        await c.ExecuteAsync(sqlDeleteAvailability, new { activityId }, tx);
        await c.ExecuteAsync(sqlDeleteAssignments, new { activityId }, tx);
        await c.ExecuteAsync(sqlDeleteInstances, new { activityId }, tx);
        await c.ExecuteAsync(sqlDeleteActivity, new { activityId }, tx);

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, ex.Message);
    }
}*/
public async Task UpdateActivityHeaderAsync(int activityId, ActivityUpdateHeaderDto dto)
{
    const string sql = @"
UPDATE dbo.Activities SET
  ActivityName=@ActivityName,
  ActivityTypeId=@ActivityTypeId,
  CourseId=@CourseId,
  LeadInstructorId=@LeadInstructorId,
  ApplicationDeadlineUtc=@ApplicationDeadlineUtc,
  UpdatedAtUtc=SYSUTCDATETIME()
WHERE ActivityId=@ActivityId";

    await using var c = Open();
    await c.ExecuteAsync(sql, new {
        ActivityId = activityId,
        dto.ActivityName,
        dto.ActivityTypeId,
        dto.CourseId,
        dto.LeadInstructorId,
        dto.ApplicationDeadlineUtc
    });
}
/*
public async Task<int> CreateActivityInstanceAsync(int activityId, ActivityInstanceEditDto dto)
{
    const string sql = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
OUTPUT INSERTED.InstanceId
VALUES
(@ActivityId,@StartUtc,@EndUtc,@RoomsCount,@RequiredInstructors)";

    await using var c = Open();
    return await c.QuerySingleAsync<int>(sql, new {
        ActivityId = activityId,
        dto.StartUtc,
        dto.EndUtc,
        dto.RoomsCount,
        dto.RequiredInstructors
    });
}
*/
/*
public async Task UpdateActivityInstanceAsync(int instanceId, ActivityInstanceEditDto dto)
{
    const string sql = @"
UPDATE dbo.ActivityInstances SET
  StartUtc=@StartUtc,
  EndUtc=@EndUtc,
  RoomsCount=@RoomsCount,
  RequiredInstructors=@RequiredInstructors,
  UpdatedAtUtc=SYSUTCDATETIME()
WHERE InstanceId=@InstanceId";

    await using var c = Open();
    await c.ExecuteAsync(sql, new {
        InstanceId = instanceId,
        dto.StartUtc,
        dto.EndUtc,
        dto.RoomsCount,
        dto.RequiredInstructors
    });
}
*/
public async Task DeleteActivityInstanceAsync(int instanceId)
{
    const string sql = @"DELETE FROM dbo.ActivityInstances WHERE InstanceId=@id";
    await using var c = Open();
    await c.ExecuteAsync(sql, new { id = instanceId });
}
public async Task<(bool Ok, string? Error)> DeleteInstanceAsync(
    int instanceId,
    int actorInstructorId,
    string? reason)
{
    const string sqlExists = @"SELECT COUNT(1) FROM dbo.ActivityInstances WHERE InstanceId=@instanceId;";
    const string sqlDelAvail = @"DELETE FROM dbo.AvailabilityRequests WHERE InstanceId=@instanceId;";
    const string sqlDelAssign = @"DELETE FROM dbo.Assignments WHERE InstanceId=@instanceId;";
    const string sqlDelInst = @"DELETE FROM dbo.ActivityInstances WHERE InstanceId=@instanceId;";

    const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'Delete', 'ActivityInstance', CAST(@instanceId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

    await using var c = Open();
    using var tx = c.BeginTransaction();
    try
    {
        var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { instanceId }, tx);
        if (exists == 0) { tx.Rollback(); return (false, "NotFound"); }

        await c.ExecuteAsync(sqlDelAvail, new { instanceId }, tx);
        await c.ExecuteAsync(sqlDelAssign, new { instanceId }, tx);

        var rows = await c.ExecuteAsync(sqlDelInst, new { instanceId }, tx);
        if (rows <= 0) { tx.Rollback(); return (false, "NotFound"); }

        var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();
        var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r });
        await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, instanceId, details }, tx);

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, ex.Message);
    }
}

public async Task<IEnumerable<GanttItemDto>> GetGanttAsync(
    DateTime fromUtc,
    DateTime toUtc,
    int? activityTypeId,
    string? q)
{
    const string sql = @"
SELECT
    a.ActivityId,
    a.ActivityName,
    a.ActivityTypeId,
    t.TypeName,
    a.CourseId,
    c.CourseName,
    a.LeadInstructorId,
    i.FullName AS LeadInstructorName,
    inst.StartUtc,
    inst.EndUtc,
    ISNULL(inst.RoomsCount, 0) AS RoomsCount,
    ISNULL(inst.RequiredInstructors, 0) AS RequiredInstructors
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
JOIN dbo.ActivityTypes t ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
LEFT JOIN dbo.Instructors i ON i.InstructorId = a.LeadInstructorId
WHERE inst.StartUtc >= @fromUtc
  AND inst.StartUtc <  @toUtc
  AND (@activityTypeId IS NULL OR a.ActivityTypeId = @activityTypeId)
  AND (
        @q IS NULL OR @q = '' OR
        a.ActivityName LIKE '%' + @q + '%' OR
        t.TypeName     LIKE '%' + @q + '%' OR
        c.CourseName   LIKE '%' + @q + '%'
      )
ORDER BY inst.StartUtc;";

    await using var c2 = Open();
    return await c2.QueryAsync<GanttItemDto>(sql, new { fromUtc, toUtc, activityTypeId, q });
}

    // ≡≡ פעילות לפי סוג ≡≡
    public async Task<IEnumerable<ActivityTypeDto>> GetActivityTypesAsync()
    {
        const string sql = @"SELECT ActivityTypeId, TypeName FROM dbo.ActivityTypes ORDER BY TypeName;";
        await using var c = NewConnection();
        return await c.QueryAsync<ActivityTypeDto>(sql);
    }
// יצירה
public async Task<int> CreateActivityTypeAsync(string typeName)
{
    const string sql = @"
INSERT INTO dbo.ActivityTypes (TypeName)
VALUES (@typeName);
SELECT CAST(SCOPE_IDENTITY() as int);";

    await using var c = Open();
    return await c.QuerySingleAsync<int>(sql, new { typeName });
}

// עדכון
public async Task<bool> UpdateActivityTypeAsync(int id, string typeName)
{
    const string sql = @"
UPDATE dbo.ActivityTypes
SET TypeName = @typeName
WHERE ActivityTypeId = @id;";

    await using var c = Open();
    var rows = await c.ExecuteAsync(sql, new { id, typeName });
    return rows > 0;
}
// =======================
// Activities (Edit/Update)
// =======================

public async Task<ActivityForEditDto?> GetActivityForEditAsync(int activityId)
{
    const string sqlActivity = @"
SELECT TOP 1
  ActivityId,
  ActivityName,
  ActivityTypeId,
  ISNULL(CourseId, 0) AS CourseId,
  ISNULL(LeadInstructorId, 0) AS LeadInstructorId,
  ApplicationDeadlineUtc
FROM dbo.Activities
WHERE ActivityId = @activityId;";

const string sqlInstances = @"
SELECT
  InstanceId,
  StartUtc,
  EndUtc,
  ISNULL(RoomsCount, 0) AS RoomsCount,
  ISNULL(RequiredInstructors, 0) AS RequiredInstructors
FROM dbo.ActivityInstances
WHERE ActivityId = @activityId
ORDER BY StartUtc;";



    await using var c = Open();

    var activity = await c.QueryFirstOrDefaultAsync<ActivityForEditDto>(
        sqlActivity, new { activityId });

    if (activity == null) return null;

    var inst = (await c.QueryAsync<ActivityInstanceEditDto>(
        sqlInstances, new { activityId })).AsList();

    activity.Instances = inst;
    return activity;
}
// =======================
// Activities: Header only
// =======================
/*
public async Task<(bool Ok, string? Error)> UpdateActivityHeaderAsync(int activityId, ActivityUpdateHeaderDto dto)
{
    if (string.IsNullOrWhiteSpace(dto.ActivityName)) return (false, "ActivityName is required");
    if (dto.ActivityTypeId <= 0) return (false, "ActivityTypeId is required");
    if (dto.CourseId <= 0) return (false, "CourseId is required");
    if (dto.LeadInstructorId <= 0) return (false, "LeadInstructorId is required");

    const string sql = @"
UPDATE dbo.Activities
SET
  ActivityName = @ActivityName,
  ActivityTypeId = @ActivityTypeId,
  CourseId = @CourseId,
  LeadInstructorId = @LeadInstructorId,
  ApplicationDeadlineUtc = @ApplicationDeadlineUtc,
  UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @ActivityId;";

    await using var c = Open();
    var rows = await c.ExecuteAsync(sql, new
    {
        ActivityId = activityId,
        dto.ActivityName,
        dto.ActivityTypeId,
        dto.CourseId,
        dto.LeadInstructorId,
        dto.ApplicationDeadlineUtc
    });

    return rows > 0 ? (true, null) : (false, "Activity not found");
}
*/
// =======================
// ActivityInstances CRUD
// =======================
public async Task<(bool Ok, string? Error, int InstanceId)> CreateActivityInstanceAsync(int activityId, ActivityInstanceEditDto dto)
{
    if (dto.StartUtc == default) return (false, "StartUtc is required", 0);
    if (dto.EndUtc == default) return (false, "EndUtc is required", 0);
    if (dto.EndUtc <= dto.StartUtc) return (false, "EndUtc must be after StartUtc", 0);

    const string sql = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors);
SELECT CAST(SCOPE_IDENTITY() as int);";

    await using var c = Open();

    // לוודא שהפעילות קיימת (אופציונלי, אבל מומלץ)
    const string sqlCheck = @"SELECT COUNT(1) FROM dbo.Activities WHERE ActivityId=@activityId;";
    var exists = await c.ExecuteScalarAsync<int>(sqlCheck, new { activityId });
    if (exists <= 0) return (false, "Activity not found", 0);

    var newId = await c.QuerySingleAsync<int>(sql, new
    {
        ActivityId = activityId,
        dto.StartUtc,
        dto.EndUtc,
        dto.RoomsCount,
        dto.RequiredInstructors
    });

    return (true, null, newId);
}

public async Task<(bool Ok, string? Error)> UpdateActivityInstanceAsync(int instanceId, ActivityInstanceEditDto dto)
{
    if (dto.StartUtc == default) return (false, "StartUtc is required");
    if (dto.EndUtc == default) return (false, "EndUtc is required");
    if (dto.EndUtc <= dto.StartUtc) return (false, "EndUtc must be after StartUtc");

    const string sql = @"
UPDATE dbo.ActivityInstances
SET
  StartUtc = @StartUtc,
  EndUtc = @EndUtc,
  RoomsCount = @RoomsCount,
  RequiredInstructors = @RequiredInstructors
WHERE InstanceId = @InstanceId;";

    await using var c = Open();
    var rows = await c.ExecuteAsync(sql, new
    {
        InstanceId = instanceId,
        dto.StartUtc,
        dto.EndUtc,
        dto.RoomsCount,
        dto.RequiredInstructors
    });

    return rows > 0 ? (true, null) : (false, "Instance not found");
}

public async Task<(bool Ok, string? Error)> DeleteInstanceAsync(int instanceId)
{
    // למחוק גם זמינויות + שיבוצים, כדי שלא יישארו FK/זבל
    const string sqlDelAvail = @"DELETE FROM dbo.AvailabilityRequests WHERE InstanceId = @instanceId;";
    const string sqlDelAssign = @"DELETE FROM dbo.Assignments WHERE InstanceId = @instanceId;";
    const string sqlDelInst = @"DELETE FROM dbo.ActivityInstances WHERE InstanceId = @instanceId;";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        await c.ExecuteAsync(sqlDelAvail, new { instanceId }, tx);
        await c.ExecuteAsync(sqlDelAssign, new { instanceId }, tx);

        var rows = await c.ExecuteAsync(sqlDelInst, new { instanceId }, tx);
        if (rows <= 0)
        {
            tx.Rollback();
            return (false, "Instance not found");
        }

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, "DB error: " + ex.Message);
    }
}

public async Task<(bool Ok, string? Error)> UpdateActivityAsync(int activityId, ActivityUpdateDto dto)
{
    // ולידציות בסיס
    if (string.IsNullOrWhiteSpace(dto.ActivityName)) return (false, "ActivityName is required");
    if (dto.ActivityTypeId <= 0) return (false, "ActivityTypeId is required");
    if (dto.CourseId <= 0) return (false, "CourseId is required");
    if (dto.LeadInstructorId <= 0) return (false, "LeadInstructorId is required");
    if (dto.Instances == null || dto.Instances.Count == 0) return (false, "At least one instance is required");

    const string sqlUpdate = @"
UPDATE dbo.Activities
SET
  ActivityName = @ActivityName,
  ActivityTypeId = @ActivityTypeId,
  CourseId = @CourseId,
  LeadInstructorId = @LeadInstructorId,
  ApplicationDeadlineUtc = @ApplicationDeadlineUtc,
  UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @ActivityId;";

    const string sqlDeleteInstances = @"
DELETE FROM dbo.ActivityInstances
WHERE ActivityId = @ActivityId;";

    const string sqlInsertInstance = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors);";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        var rows = await c.ExecuteAsync(sqlUpdate, new
        {
            ActivityId = activityId,
            dto.ActivityName,
            dto.ActivityTypeId,
            dto.CourseId,
            dto.LeadInstructorId,
            dto.ApplicationDeadlineUtc
        }, tx);

        if (rows <= 0)
        {
            tx.Rollback();
            return (false, "Activity not found");
        }

        await c.ExecuteAsync(sqlDeleteInstances, new { ActivityId = activityId }, tx);

        foreach (var inst in dto.Instances)
        {
            await c.ExecuteAsync(sqlInsertInstance, new
            {
                ActivityId = activityId,
                inst.StartUtc,
                inst.EndUtc,
                inst.RoomsCount,
                inst.RequiredInstructors
            }, tx);
        }

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, "DB error: " + ex.Message);
    }
}

// בדיקת תלות בקורסים (כדי לא למחוק סוג שיש לו Courses)
public async Task<bool> ActivityTypeHasCoursesAsync(int id)
{
    const string sql = @"
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM dbo.Courses WHERE ActivityTypeId = @id
) THEN 1 ELSE 0 END;";

    await using var c = Open();
    var x = await c.QuerySingleAsync<int>(sql, new { id });
    return x == 1;
}
// =======================
// Activities Search
// =======================
public async Task<IEnumerable<ActivitySearchResultDto>> SearchActivitiesAsync(
    int? activityId,
    string? nameContains,
    int? activityTypeId,
    int? leadInstructorId,
    int take = 50)
{
    const string sql = @"
;WITH NextInst AS (
    SELECT ai.ActivityId, MIN(ai.StartUtc) AS NextStartUtc
    FROM dbo.ActivityInstances ai
    WHERE ai.StartUtc >= SYSUTCDATETIME()
    GROUP BY ai.ActivityId
)
SELECT TOP (@take)
    a.ActivityId,
    a.ActivityName,
    a.ActivityTypeId,
    t.TypeName,
    a.CourseId,
    c.CourseName,
    a.LeadInstructorId,
    i.FullName AS LeadInstructorName,
    n.NextStartUtc
FROM dbo.Activities a
JOIN dbo.ActivityTypes t ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
LEFT JOIN dbo.Instructors i ON i.InstructorId = a.LeadInstructorId
LEFT JOIN NextInst n ON n.ActivityId = a.ActivityId
WHERE
    (@activityId IS NULL OR a.ActivityId = @activityId)
    AND (@activityTypeId IS NULL OR a.ActivityTypeId = @activityTypeId)
    AND (@leadInstructorId IS NULL OR a.LeadInstructorId = @leadInstructorId)
    AND (
        @nameContains IS NULL OR @nameContains = '' OR
        a.ActivityName LIKE '%' + @nameContains + '%'
    )
ORDER BY
    CASE WHEN n.NextStartUtc IS NULL THEN 1 ELSE 0 END,
    n.NextStartUtc,
    a.ActivityName;";

    await using var c2 = Open();
    return await c2.QueryAsync<ActivitySearchResultDto>(sql, new
    {
        activityId,
        nameContains,
        activityTypeId,
        leadInstructorId,
        take
    });
}
public async Task<LeadActivityDetailsDto?> GetLeadActivityDetailsAsync(int activityId, int? mustBeLeadInstructorId)
{
    const string sqlActivity = @"
SELECT TOP 1
  a.ActivityId,
  a.ActivityName,
  a.ActivityTypeId,
  a.CourseId,
  a.LeadInstructorId,
  a.ApplicationDeadlineUtc
FROM dbo.Activities a
WHERE a.ActivityId = @activityId
  AND (@leadId IS NULL OR a.LeadInstructorId = @leadId);";

    const string sqlInstances = @"
SELECT
  inst.InstanceId,
  inst.StartUtc,
  inst.EndUtc,
  ISNULL(inst.RoomsCount,0) AS RoomsCount,
  ISNULL(inst.RequiredInstructors,0) AS RequiredInstructors
FROM dbo.ActivityInstances inst
WHERE inst.ActivityId = @activityId
ORDER BY inst.StartUtc;";

    await using var c = Open();
    var a = await c.QueryFirstOrDefaultAsync<LeadActivityDetailsDto>(sqlActivity, new { activityId, leadId = mustBeLeadInstructorId });
    if (a == null) return null;

    a.Instances = (await c.QueryAsync<ActivityInstanceWithIdDto>(sqlInstances, new { activityId })).AsList();
    return a;
}
public async Task<IEnumerable<InstructorDto>> GetEligibleInstructorsForLeadActivityAsync(int activityId, int? mustBeLeadInstructorId)
{
    const string sql = @"
SELECT i.InstructorId, i.FullName, i.Email
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
WHERE ic.CourseId = (
    SELECT TOP 1 a.CourseId
    FROM dbo.Activities a
    WHERE a.ActivityId = @activityId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
)
ORDER BY i.FullName;";

    await using var c = Open();
    return await c.QueryAsync<InstructorDto>(sql, new { activityId, leadId = mustBeLeadInstructorId });
}
public async Task<IEnumerable<LeadInstanceAvailabilityDto>> GetLeadInstanceAvailabilityAsync(int instanceId, int? mustBeLeadInstructorId)
{
    const string sql = @"
;WITH Guard AS (
    SELECT TOP 1 a.ActivityId
    FROM dbo.ActivityInstances inst
    JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE inst.InstanceId = @instanceId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
)
SELECT
  ar.AvailabilityId,
  ar.InstanceId,
  ar.InstructorId,
  i.FullName,
  i.Email,
  ar.Status,
  ar.SubmittedAtUtc,
  ar.DecisionAtUtc,
  ar.DecisionByInstructorId,
  ar.DecisionNote,
  CASE WHEN EXISTS (
      SELECT 1 FROM dbo.Assignments ass
      WHERE ass.InstanceId = ar.InstanceId
        AND ass.InstructorId = ar.InstructorId
        AND ass.Status = 'Approved'
        AND ass.CancelledAtUtc IS NULL
  ) THEN 1 ELSE 0 END AS IsAssigned
FROM dbo.AvailabilityRequests ar
JOIN dbo.Instructors i ON i.InstructorId = ar.InstructorId
WHERE ar.InstanceId = @instanceId
  AND EXISTS (SELECT 1 FROM Guard)
ORDER BY i.FullName;";

    await using var c = Open();
    return await c.QueryAsync<LeadInstanceAvailabilityDto>(sql, new { instanceId, leadId = mustBeLeadInstructorId });
}
public async Task<IEnumerable<FairnessRowDto>> GetFairnessForInstanceAsync(int instanceId, int? mustBeLeadInstructorId)
{
    const string sql = @"
;WITH Guard AS (
    SELECT TOP 1 a.ActivityId, a.CourseId, inst.StartUtc
    FROM dbo.ActivityInstances inst
    JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE inst.InstanceId = @instanceId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
),
Bounds AS (
    SELECT
      CourseId,
      DATEFROMPARTS(YEAR(StartUtc), MONTH(StartUtc), 1) AS M1,
      DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(StartUtc), MONTH(StartUtc), 1)) AS M2
    FROM Guard
)
SELECT
  i.InstructorId,
  i.FullName,
  i.Email,
  (
    SELECT COUNT(1)
    FROM dbo.Assignments ass
    WHERE ass.InstructorId = i.InstructorId
      AND ass.Status = 'Approved'
      AND ass.CancelledAtUtc IS NULL
      AND ass.AssignedAtUtc >= b.M1
      AND ass.AssignedAtUtc <  b.M2
  ) AS ApprovedInMonth
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
JOIN Bounds b ON b.CourseId = ic.CourseId
WHERE EXISTS (SELECT 1 FROM Guard)
ORDER BY ApprovedInMonth, i.FullName;";

    await using var c = Open();
    return await c.QueryAsync<FairnessRowDto>(sql, new { instanceId, leadId = mustBeLeadInstructorId });
}
// ===============================
// FAIRNESS (טבלת צדק)
// ===============================
public async Task<List<InstanceFairnessDto>> GetFairnessForInstanceAsync(int instanceId)
{
    const string sql = @"
WITH Eligible AS (
    SELECT ic.InstructorId
    FROM InstructorCourses ic
    JOIN ActivityInstances ai ON ai.InstanceId = @instanceId
    JOIN Activities a ON a.ActivityId = ai.ActivityId
    WHERE ic.CourseId = a.CourseId
),
MonthlyApproved AS (
    SELECT ass.InstructorId, COUNT(*) AS ApprovedCount
    FROM Assignments ass
    JOIN ActivityInstances ai2 ON ai2.InstanceId = ass.InstanceId
    WHERE ass.Status = 'Approved'
      AND ass.CancelledAtUtc IS NULL
      AND ai2.StartUtc >= DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)
    GROUP BY ass.InstructorId
)
SELECT 
    e.InstructorId,
    ISNULL(m.ApprovedCount, 0) AS ApprovedCount
FROM Eligible e
LEFT JOIN MonthlyApproved m ON m.InstructorId = e.InstructorId
ORDER BY ISNULL(m.ApprovedCount, 0);";

    await using var c = Open();
    var rows = await c.QueryAsync<InstanceFairnessDto>(sql, new { instanceId });
    return rows.ToList();
}


// ===============================
// SOFT DELETE ACTIVITY
// ===============================
public async Task<(bool Ok, string? Error)> SoftDeleteActivityAsync(
    int activityId,
    int actorInstructorId,
    string? reason)
{
    const string sqlExists = @"SELECT COUNT(1) FROM Activities WHERE ActivityId=@activityId;";
    const string sqlActivity = @"
UPDATE Activities
SET IsCancelled = 1,
    CancelReason = @reason,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @activityId;";

    const string sqlInstances = @"
UPDATE ActivityInstances
SET IsCancelled = 1,
    CancelReason = @reason,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @activityId;";

    const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'SoftDelete', 'Activity', CAST(@activityId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { activityId }, tx);
        if (exists == 0)
        {
            tx.Rollback();
            return (false, "NotFound");
        }

        var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();

        await c.ExecuteAsync(sqlInstances, new { activityId, reason = r }, tx);
        await c.ExecuteAsync(sqlActivity, new { activityId, reason = r }, tx);

        var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r });
        await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, activityId, details }, tx);

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, ex.Message);
    }
}
public async Task<(bool Ok, string? Error)> SoftDeleteInstanceAsync(
    int instanceId,
    int actorInstructorId,
    string? reason)
{
    const string sqlExists = @"SELECT COUNT(1) FROM ActivityInstances WHERE InstanceId=@instanceId;";
    const string sqlInst = @"
UPDATE ActivityInstances
SET IsCancelled = 1,
    CancelReason = @reason,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE InstanceId = @instanceId;";

    const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'SoftDelete', 'ActivityInstance', CAST(@instanceId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

    await using var c = Open();
    using var tx = c.BeginTransaction();
    try
    {
        var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { instanceId }, tx);
        if (exists == 0) { tx.Rollback(); return (false, "NotFound"); }

        var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();

        await c.ExecuteAsync(sqlInst, new { instanceId, reason = r }, tx);

        var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r });
        await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, instanceId, details }, tx);

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, ex.Message);
    }
}

public async Task<(bool Ok, string? Error)> ApproveLeadAssignmentsAsync(
    int instanceId,
    List<int> instructorIds,
    int actorInstructorId,
    bool isAdmin,
    string? note)
{
    const string sqlGuard = @"
SELECT TOP 1 a.LeadInstructorId, inst.RequiredInstructors
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
WHERE inst.InstanceId = @instanceId;";

    await using var c = Open();
    var g = await c.QueryFirstOrDefaultAsync<(int? LeadInstructorId, int RequiredInstructors)>(sqlGuard, new { instanceId });
    if (g.RequiredInstructors <= 0) return (false, "Instance not found");

    if (!isAdmin && g.LeadInstructorId != actorInstructorId)
        return (false, "Forbidden: not lead of this activity");

    if (instructorIds.Count > g.RequiredInstructors)
        return (false, $"Too many instructors. Required={g.RequiredInstructors}");

    const string sqlUpsertAssign = @"
IF EXISTS (SELECT 1 FROM dbo.Assignments WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId AND CancelledAtUtc IS NULL)
BEGIN
  UPDATE dbo.Assignments
  SET Status='Approved', AssignedAtUtc=SYSUTCDATETIME(), AssignedByInstructorId=@ById
  WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId AND CancelledAtUtc IS NULL;
END
ELSE
BEGIN
  INSERT INTO dbo.Assignments (InstanceId, InstructorId, AssignedAtUtc, AssignedByInstructorId, Status)
  VALUES (@InstanceId, @InstructorId, SYSUTCDATETIME(), @ById, 'Approved');
END";

    const string sqlUpsertAvail = @"
IF EXISTS (SELECT 1 FROM dbo.AvailabilityRequests WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId)
BEGIN
  UPDATE dbo.AvailabilityRequests
  SET Status='Approved',
      DecisionAtUtc=SYSUTCDATETIME(),
      DecisionByInstructorId=@ById,
      DecisionNote=@Note
  WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId;
END
ELSE
BEGIN
  INSERT INTO dbo.AvailabilityRequests
  (InstanceId, InstructorId, Status, SubmittedAtUtc, DecisionAtUtc, DecisionByInstructorId, DecisionNote)
  VALUES
  (@InstanceId, @InstructorId, 'Approved', SYSUTCDATETIME(), SYSUTCDATETIME(), @ById, @Note);
END";

    using var tx = c.BeginTransaction();
    try
    {
        foreach (var insId in instructorIds.Distinct())
        {
            await c.ExecuteAsync(sqlUpsertAssign, new { InstanceId = instanceId, InstructorId = insId, ById = actorInstructorId }, tx);
            await c.ExecuteAsync(sqlUpsertAvail,  new { InstanceId = instanceId, InstructorId = insId, ById = actorInstructorId, Note = note }, tx);
        }

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, "DB error: " + ex.Message);
    }
}

/*
public async Task<(bool Ok, string? Error, int SentCount)> SendLeadAvailabilityReminderAsync(
    int instanceId,
    int actorInstructorId,
    bool isAdmin,
    bool onlyNotResponded,
    IConfiguration cfg,
    Func<IConfiguration, string, string, string, Task> sendSmtpAsync)
{
    const string sqlHeader = @"
SELECT TOP 1
  a.ActivityId,
  a.ActivityName,
  a.CourseId,
  c.CourseName,
  a.LeadInstructorId,
  inst.StartUtc,
  inst.EndUtc
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
WHERE inst.InstanceId = @instanceId;";

    await using var c = Open();
    var h = await c.QueryFirstOrDefaultAsync(sqlHeader, new { instanceId });
    if (h == null) return (false, "Instance not found", 0);

    int leadId = (int)(h.LeadInstructorId ?? 0);
    if (!isAdmin && leadId != actorInstructorId)
        return (false, "Forbidden: not lead of this activity", 0);

    int courseId = (int)(h.CourseId ?? 0);
    if (courseId <= 0) return (false, "Activity has no CourseId", 0);

    const string sqlEligible = @"
SELECT i.InstructorId, i.Email, i.FullName
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
WHERE ic.CourseId=@courseId
ORDER BY i.FullName;";

    var eligible = (await c.QueryAsync<(int InstructorId, string Email, string FullName)>(sqlEligible, new { courseId })).ToList();

    HashSet<int> responded = new();
    if (onlyNotResponded)
    {
        const string sqlResp = @"SELECT InstructorId FROM dbo.AvailabilityRequests WHERE InstanceId=@instanceId;";
        responded = (await c.QueryAsync<int>(sqlResp, new { instanceId })).ToHashSet();
    }

    string fmtIL(DateTime utc)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
            return local.ToString("dd/MM/yyyy HH:mm");
        }
        catch { return utc.ToString("dd/MM/yyyy HH:mm") + " UTC"; }
    }

    var startUtc = (DateTime)h.StartUtc;
    var endUtc   = (DateTime)h.EndUtc;

    var baseUrl = cfg["App:BaseUrl"] ?? "";
    var link = string.IsNullOrWhiteSpace(baseUrl) ? "" : $"{baseUrl.TrimEnd('/')}/availability.html?instanceId={instanceId}";

    int sent = 0;

    foreach (var ins in eligible)
    {
        if (string.IsNullOrWhiteSpace(ins.Email)) continue;
        if (onlyNotResponded && responded.Contains(ins.InstructorId)) continue;

        var subject = $"בקשת זמינות: {h.ActivityName} ({fmtIL(startUtc)})";
        var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h2>בקשת זמינות למופע</h2>
  <div><b>פעילות:</b> {h.ActivityName}</div>
  <div><b>קורס:</b> {h.CourseName}</div>
  <div><b>מועד:</b> {fmtIL(startUtc)} – {fmtIL(endUtc)}</div>
  <hr/>
  <p>נא להיכנס ולהציע זמינות.</p>
  {(string.IsNullOrWhiteSpace(link) ? "" : $@"<p><a href=""{link}"">לחץ/י כאן להגשת זמינות</a></p>")}
  <div style=""color:#6b7280;font-size:12px"">InstanceId: {instanceId}</div>
</div>";

        await EnqueueEmailAsync(ins.Email, subject, body, "AvailabilityReminder", instanceId.ToString());

        try { await sendSmtpAsync(cfg, ins.Email, subject, body); }
        catch {  }

        sent++;
    }

    return (true, null, sent);
}*/
/*
public async Task<(bool Ok, string? Error, List<EmailPayload> Emails)> BuildLeadAvailabilityReminderEmailsAsync(
    int instanceId,
    int actorInstructorId,
    bool isAdmin,
    bool onlyNotResponded,
    IConfiguration cfg)
{
    const string sqlHeader = @"
SELECT TOP 1
  a.ActivityId,
  a.ActivityName,
  a.CourseId,
  c.CourseName,
  a.LeadInstructorId,
  inst.StartUtc,
  inst.EndUtc
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
WHERE inst.InstanceId = @instanceId;";

    const string sqlEligible = @"
SELECT i.InstructorId, i.Email
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
JOIN dbo.ActivityInstances inst ON inst.InstanceId = @instanceId
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
WHERE ic.CourseId = a.CourseId
  AND i.Status = 'Active';";

    const string sqlResponded = @"
SELECT InstructorId
FROM dbo.AvailabilityRequests
WHERE InstanceId = @instanceId;";

    await using var c = Open();

    var h = await c.QueryFirstOrDefaultAsync(sqlHeader, new { instanceId });
    if (h == null) return (false, "Instance not found", new List<EmailPayload>());

    int leadId = (int)(h.LeadInstructorId ?? 0);
    if (!isAdmin && leadId != actorInstructorId)
        return (false, "Forbidden: not lead of this activity", new List<EmailPayload>());

    var eligible = (await c.QueryAsync(sqlEligible, new { instanceId })).ToList();

    HashSet<int> responded = new();
    if (onlyNotResponded)
        responded = (await c.QueryAsync<int>(sqlResponded, new { instanceId })).ToHashSet();

    string fmtIL(DateTime utc)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
            return local.ToString("dd/MM/yyyy HH:mm");
        }
        catch { return utc.ToString("dd/MM/yyyy HH:mm") + " UTC"; }
    }

    var startUtc = (DateTime)h.StartUtc;
    var endUtc   = (DateTime)h.EndUtc;

    var baseUrl = cfg["App:BaseUrl"] ?? "";
    var link = string.IsNullOrWhiteSpace(baseUrl) ? "" : $"{baseUrl.TrimEnd('/')}/availability.html?instanceId={instanceId}";

    var emails = new List<EmailPayload>();

    foreach (var ins in eligible)
    {
        int instructorId = (int)ins.InstructorId;
        string email = (string)ins.Email;

        if (string.IsNullOrWhiteSpace(email)) continue;
        if (onlyNotResponded && responded.Contains(instructorId)) continue;

        var subject = $"בקשת זמינות: {h.ActivityName} ({fmtIL(startUtc)})";
        var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h2>בקשת זמינות למופע</h2>
  <div><b>פעילות:</b> {h.ActivityName}</div>
  <div><b>קורס:</b> {h.CourseName}</div>
  <div><b>מועד:</b> {fmtIL(startUtc)} – {fmtIL(endUtc)}</div>
  <hr/>
  <p>נא להיכנס ולהציע זמינות.</p>
  {(string.IsNullOrWhiteSpace(link) ? "" : $@"<p><a href=""{link}"">לחץ/י כאן להגשת זמינות</a></p>")}
  <div style=""color:#6b7280;font-size:12px"">InstanceId: {instanceId}</div>
</div>";

        emails.Add(new EmailPayload(
            ToEmail: email,
            Subject: subject,
            BodyHtml: body,
            RelatedEntity: "AvailabilityReminder",
            RelatedId: instanceId.ToString()
        ));
    }

    return (true, null, emails);
}*/
public async Task<(bool Ok, string? Error, List<ActivityEmailDto> Emails)>
BuildLeadAvailabilityReminderEmailsAsync(
    int instanceId,
    int actorInstructorId,
    bool isAdmin,
    bool onlyNotResponded,
    IConfiguration cfg)
{
    // כאן אתה לוקח את הלוגיקה הקיימת
    // אבל במקום לשלוח – רק בונה רשימת מיילים

    var emails = new List<ActivityEmailDto>();

    // לדוגמה:
    emails.Add(new ActivityEmailDto
    {
        ToEmail = "test@bgu.ac.il",
        Subject = "בדיקת זמינות",
        BodyHtml = "<b>נא להגיש זמינות</b>",
        RelatedEntity = "ActivityInstance",
        RelatedId = instanceId.ToString()
    });

    return (true, null, emails);
}

public async Task<(bool Ok, string? Error)> DeleteActivityAsync(
    int activityId,
    int actorInstructorId,
    string? reason)
{
    const string sqlGetInstances = @"SELECT InstanceId FROM dbo.ActivityInstances WHERE ActivityId=@activityId;";
    const string sqlDelAvail = @"DELETE FROM dbo.AvailabilityRequests WHERE InstanceId IN @ids;";
    const string sqlDelAssign = @"DELETE FROM dbo.Assignments WHERE InstanceId IN @ids;";
    const string sqlDelInst = @"DELETE FROM dbo.ActivityInstances WHERE ActivityId=@activityId;";
    const string sqlDelAct = @"DELETE FROM dbo.Activities WHERE ActivityId=@activityId;";

    const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'Delete', 'Activity', CAST(@activityId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        var ids = (await c.QueryAsync<int>(sqlGetInstances, new { activityId }, tx)).ToList();

        if (ids.Count > 0)
        {
            await c.ExecuteAsync(sqlDelAvail, new { ids }, tx);
            await c.ExecuteAsync(sqlDelAssign, new { ids }, tx);
        }

        await c.ExecuteAsync(sqlDelInst, new { activityId }, tx);

        var rows = await c.ExecuteAsync(sqlDelAct, new { activityId }, tx);
        if (rows <= 0)
        {
            tx.Rollback();
            return (false, "NotFound");
        }

        var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();
        var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r, deletedInstances = ids.Count });
        await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, activityId, details }, tx);

        tx.Commit();
        return (true, null);
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return (false, "DB error: " + ex.Message);
    }
}


// מחיקה (מוגנת מתלות)
public async Task<(bool Ok, string? Error)> DeleteActivityTypeAsync(int id)
{
    if (await ActivityTypeHasCoursesAsync(id))
        return (false, "לא ניתן למחוק: קיימים קורסים המשויכים לסוג פעילות זה.");

    const string sql = @"
DELETE FROM dbo.ActivityTypes
WHERE ActivityTypeId = @id;";

    await using var c = Open();
    var rows = await c.ExecuteAsync(sql, new { id });
    return rows > 0 ? (true, null) : (false, "סוג פעילות לא נמצא.");
}
public async Task<IEnumerable<ActivityEmailInstanceDto>> GetActivityInstancesForEmailAsync(int activityId)
{
    const string sql = @"
SELECT
  inst.InstanceId,
  inst.StartUtc,
  inst.EndUtc,
  inst.RoomsCount,
  inst.RequiredInstructors
FROM dbo.ActivityInstances inst
WHERE inst.ActivityId = @activityId
ORDER BY inst.StartUtc;";

    await using var cn = Open();
    return await cn.QueryAsync<ActivityEmailInstanceDto>(sql, new { activityId });
}

public async Task<ActivityEmailHeaderDto?> GetActivityEmailHeaderAsync(int activityId)
{
    const string sql = @"
SELECT
  a.ActivityId,
  a.ActivityName,
  t.TypeName,
  c.CourseName,
  a.ApplicationDeadlineUtc,
  a.LeadInstructorId,
  li.FullName AS LeadInstructorName,
  li.Email    AS LeadInstructorEmail
FROM dbo.Activities a
JOIN dbo.ActivityTypes t ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
LEFT JOIN dbo.Instructors li ON li.InstructorId = a.LeadInstructorId
WHERE a.ActivityId = @activityId;";

    await using var cn = Open();
    return await cn.QueryFirstOrDefaultAsync<ActivityEmailHeaderDto>(sql, new { activityId });
}

    // ≡≡ קלנדר מופעי פעילויות ≡≡

public async Task<IEnumerable<ActivityCalendarItemDto>> GetActivitiesCalendarAsync(
    DateTime fromUtc,
    DateTime toUtc,
    int? activityTypeId)
{
    const string sql = @"
SELECT
    inst.InstanceId AS ActivityInstanceId,  -- ✅ FIX: אצלך העמודה נקראת InstanceId
    a.ActivityId,
    a.ActivityName,
    a.ActivityTypeId,
    t.TypeName,
    a.CourseId,
    c.CourseName,
    a.LeadInstructorId,
    i.FullName AS LeadInstructorName,
    inst.StartUtc,
    inst.EndUtc
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a
    ON a.ActivityId = inst.ActivityId
JOIN dbo.ActivityTypes t
    ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses c
    ON c.CourseId = a.CourseId
LEFT JOIN dbo.Instructors i
    ON i.InstructorId = a.LeadInstructorId
WHERE inst.StartUtc >= @fromUtc
  AND inst.StartUtc <  @toUtc
  AND (@activityTypeId IS NULL OR a.ActivityTypeId = @activityTypeId)
ORDER BY inst.StartUtc;";

    await using var c = Open();
    return await c.QueryAsync<ActivityCalendarItemDto>(sql, new
    {
        fromUtc,
        toUtc,
        activityTypeId
    });
}
public sealed record EmailPayload(
    string ToEmail,
    string Subject,
    string BodyHtml,
    string? RelatedEntity,
    string? RelatedId
);


    // ≡≡ קורסים לפי סוג פעילות ≡≡
    public async Task<IEnumerable<CourseDto>> GetCoursesByActivityTypeAsync(int activityTypeId)
    {
        const string sql = @"
        SELECT CourseId, CourseName, ActivityTypeId
        FROM dbo.Courses
        WHERE ActivityTypeId=@activityTypeId
        ORDER BY CourseName;";

        await using var c = NewConnection();
        return await c.QueryAsync<CourseDto>(sql, new { activityTypeId });
    }

    // ≡≡ מדריכים לפי קורס ≡≡
    public async Task<IEnumerable<InstructorDto>> GetInstructorsByCourseAsync(int courseId)
    {
        const string sql = @"
             SELECT i.InstructorId, i.FullName, i.Email
        FROM dbo.Instructors i
        JOIN dbo.InstructorCourses ci ON ci.InstructorId=i.InstructorId
        WHERE ci.CourseId=@courseId
        ORDER BY i.FullName;";

        await using var c = NewConnection();
        return await c.QueryAsync<InstructorDto>(sql,new{courseId});
    }

    // 🚀 יצירת פעילות — כולל CourseId שמור ב-DB!
  public async Task<int> CreateActivityAsync(ActivityCreateDto request)
{
    const string sqlActivity = @"
INSERT INTO dbo.Activities
(ActivityName, ActivityTypeId, Department, CourseId,
 ApplicationDeadlineUtc, CreatedByInstructorId,
 IsCancelled, CancelReason,
 CreatedAtUtc, UpdatedAtUtc, LeadInstructorId)
OUTPUT INSERTED.ActivityId
VALUES
(@ActivityName, @ActivityTypeId,'',
 @CourseId, @ApplicationDeadlineUtc,
 @LeadInstructorId,0,NULL,
 SYSUTCDATETIME(),SYSUTCDATETIME(),
 @LeadInstructorId);";

    const string sqlInsertInstance = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors);";

    await using var c = Open();
    using var tx = c.BeginTransaction();

    try
    {
        // 1️⃣ יצירת Activity
        var activityId = await c.QuerySingleAsync<int>(
            sqlActivity,
            request,
            tx
        );

        // 2️⃣ יצירת מופעים
        foreach (var inst in request.Instances)
        {
            await c.ExecuteAsync(sqlInsertInstance, new
            {
                ActivityId = activityId,
                inst.StartUtc,
                inst.EndUtc,
                inst.RoomsCount,
                inst.RequiredInstructors
            }, tx);
        }

        tx.Commit();
        return activityId;
    }
    catch
    {
        tx.Rollback();
        throw;
    }
}

}
