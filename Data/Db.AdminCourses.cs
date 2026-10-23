using Dapper;

public sealed partial class Db
{
    public async Task<List<AdminCourseRowDto>> GetAdminCoursesAsync()
    {
        // Check whether DefaultLeadInstructorId column exists before querying
        const string colCheck = @"
SELECT COUNT(1) FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Courses') AND name = 'DefaultLeadInstructorId';";

        const string sqlWithLead = @"
SELECT
    c.CourseId,
    c.CourseName,
    c.CourseCode,
    c.ActivityTypeId,
    at.TypeName          AS ActivityTypeName,
    c.IsActive,
    c.DefaultLeadInstructorId,
    -- Explicit lead name; fallback to most common lead from activities when not set
    ISNULL(lead.FullName, actLeadInst.FullName) AS DefaultLeadName,
    COUNT(DISTINCT a.ActivityId)    AS ActivitiesCount,
    COUNT(DISTINCT ic.InstructorId) AS InstructorsCount
FROM dbo.Courses c
INNER JOIN dbo.ActivityTypes at ON at.ActivityTypeId = c.ActivityTypeId
LEFT  JOIN dbo.Activities a      ON a.CourseId = c.CourseId
LEFT  JOIN dbo.InstructorCourses ic ON ic.CourseId = c.CourseId
LEFT  JOIN dbo.Instructors lead  ON lead.InstructorId = c.DefaultLeadInstructorId
-- Derive lead from Activities when DefaultLeadInstructorId is not set
LEFT JOIN (
    SELECT CourseId, MIN(LeadInstructorId) AS LeadId
    FROM dbo.Activities
    WHERE CourseId IS NOT NULL AND LeadInstructorId IS NOT NULL
    GROUP BY CourseId
) actLead ON actLead.CourseId = c.CourseId AND c.DefaultLeadInstructorId IS NULL
LEFT JOIN dbo.Instructors actLeadInst ON actLeadInst.InstructorId = actLead.LeadId
GROUP BY
    c.CourseId, c.CourseName, c.CourseCode, c.ActivityTypeId,
    at.TypeName, c.IsActive, c.DefaultLeadInstructorId, lead.FullName,
    actLead.LeadId, actLeadInst.FullName
ORDER BY c.CourseName;";

        const string sqlNoLead = @"
SELECT
    c.CourseId,
    c.CourseName,
    c.CourseCode,
    c.ActivityTypeId,
    at.TypeName AS ActivityTypeName,
    c.IsActive,
    NULL        AS DefaultLeadInstructorId,
    NULL        AS DefaultLeadName,
    COUNT(DISTINCT a.ActivityId)    AS ActivitiesCount,
    COUNT(DISTINCT ic.InstructorId) AS InstructorsCount
FROM dbo.Courses c
INNER JOIN dbo.ActivityTypes at ON at.ActivityTypeId = c.ActivityTypeId
LEFT  JOIN dbo.Activities a      ON a.CourseId = c.CourseId
LEFT  JOIN dbo.InstructorCourses ic ON ic.CourseId = c.CourseId
GROUP BY c.CourseId, c.CourseName, c.CourseCode, c.ActivityTypeId, at.TypeName, c.IsActive
ORDER BY c.CourseName;";

        await using var c = Open();
        var colExists = await c.QuerySingleAsync<int>(colCheck) > 0;

        if (!colExists)
        {
            // Try to add the column, then recheck
            try { await c.ExecuteAsync(@"ALTER TABLE dbo.Courses ADD DefaultLeadInstructorId INT NULL;"); colExists = true; }
            catch { /* No ALTER TABLE permission — fall back to query without lead */ }
        }

        var sql = colExists ? sqlWithLead : sqlNoLead;
        return (await c.QueryAsync<AdminCourseRowDto>(sql)).AsList();
    }

    public async Task<List<CourseManagerPickDto>> GetCourseManagersAsync()
    {
        const string sql = @"
SELECT InstructorId, FullName, Email
FROM dbo.Instructors
WHERE [Status] IN ('active','approved')
ORDER BY FullName;";

        await using var c = Open();
        return (await c.QueryAsync<CourseManagerPickDto>(sql)).AsList();
    }

    public async Task<int> CreateAdminCourseAsync(AdminCourseUpsertDto dto)
    {
        await using var c = Open();

        // Try to add the column if it doesn't exist yet
        try { await c.ExecuteAsync("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.Courses') AND name='DefaultLeadInstructorId') ALTER TABLE dbo.Courses ADD DefaultLeadInstructorId INT NULL;"); }
        catch { /* no ALTER TABLE permission — fall back to INSERT without it */ }

        var hasLead = await c.ExecuteScalarAsync<int>(@"
SELECT COUNT(1) FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Courses') AND name = 'DefaultLeadInstructorId';") > 0;

        var name = dto.CourseName.Trim();
        var code = string.IsNullOrWhiteSpace(dto.CourseCode) ? null : dto.CourseCode.Trim();

        if (hasLead)
        {
            const string sql = @"
INSERT INTO dbo.Courses (ActivityTypeId, CourseName, CourseCode, IsActive, DefaultLeadInstructorId, CreatedAtUtc)
VALUES (@ActivityTypeId, @CourseName, @CourseCode, @IsActive, @DefaultLeadInstructorId, SYSUTCDATETIME());
SELECT CAST(SCOPE_IDENTITY() AS int);";
            return await c.QuerySingleAsync<int>(sql, new { dto.ActivityTypeId, CourseName = name, CourseCode = code, dto.IsActive, dto.DefaultLeadInstructorId });
        }
        else
        {
            const string sql = @"
INSERT INTO dbo.Courses (ActivityTypeId, CourseName, CourseCode, IsActive, CreatedAtUtc)
VALUES (@ActivityTypeId, @CourseName, @CourseCode, @IsActive, SYSUTCDATETIME());
SELECT CAST(SCOPE_IDENTITY() AS int);";
            return await c.QuerySingleAsync<int>(sql, new { dto.ActivityTypeId, CourseName = name, CourseCode = code, dto.IsActive });
        }
    }

    public async Task<bool> UpdateAdminCourseAsync(int courseId, AdminCourseUpsertDto dto)
    {
        await using var c = Open();

        var hasLead = await c.ExecuteScalarAsync<int>(@"
SELECT COUNT(1) FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Courses') AND name = 'DefaultLeadInstructorId';") > 0;

        var name = dto.CourseName.Trim();
        var code = string.IsNullOrWhiteSpace(dto.CourseCode) ? null : dto.CourseCode.Trim();

        int rows;
        if (hasLead)
        {
            const string sql = @"
UPDATE dbo.Courses
SET CourseName=@CourseName, CourseCode=@CourseCode, ActivityTypeId=@ActivityTypeId,
    IsActive=@IsActive, DefaultLeadInstructorId=@DefaultLeadInstructorId
WHERE CourseId=@CourseId;";
            rows = await c.ExecuteAsync(sql, new { CourseId = courseId, CourseName = name, CourseCode = code, dto.ActivityTypeId, dto.IsActive, dto.DefaultLeadInstructorId });
        }
        else
        {
            const string sql = @"
UPDATE dbo.Courses
SET CourseName=@CourseName, CourseCode=@CourseCode, ActivityTypeId=@ActivityTypeId, IsActive=@IsActive
WHERE CourseId=@CourseId;";
            rows = await c.ExecuteAsync(sql, new { CourseId = courseId, CourseName = name, CourseCode = code, dto.ActivityTypeId, dto.IsActive });
        }
        return rows > 0;
    }

    public async Task<AdminDeleteResultDto> DeleteAdminCourseAsync(int courseId)
    {
        const string countSql = @"
SELECT
    (SELECT COUNT(1) FROM dbo.Activities       WHERE CourseId = @courseId) AS ActivitiesCount,
    (SELECT COUNT(1) FROM dbo.InstructorCourses WHERE CourseId = @courseId) AS InstructorsCount;";

        const string deleteSql = @"DELETE FROM dbo.Courses WHERE CourseId = @courseId;";

        await using var c = Open();
        var counts = await c.QueryFirstOrDefaultAsync<AdminDeleteResultDto>(countSql, new { courseId });
        if (counts == null)
            return new AdminDeleteResultDto { Ok = false, Error = "CourseNotFound" };

        if (counts.ActivitiesCount > 0)
        {
            counts.Ok = false;
            counts.Error = "לא ניתן למחוק קורס שיש לו פעילויות משויכות.";
            return counts;
        }

        using var tx = c.BeginTransaction();
        try
        {
            if (counts.InstructorsCount > 0)
                await c.ExecuteAsync("DELETE FROM dbo.InstructorCourses WHERE CourseId = @courseId;", new { courseId }, tx);

            var rows = await c.ExecuteAsync(deleteSql, new { courseId }, tx);
            if (rows == 0) { tx.Rollback(); return new AdminDeleteResultDto { Ok = false, Error = "CourseNotFound" }; }

            tx.Commit();
            return new AdminDeleteResultDto { Ok = true };
        }
        catch { tx.Rollback(); throw; }
    }

    public async Task<bool> CourseExistsAsync(int courseId)
    {
        await using var c = Open();
        var exists = await c.QuerySingleAsync<int>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Courses WHERE CourseId = @courseId) THEN 1 ELSE 0 END;",
            new { courseId });
        return exists == 1;
    }
}
