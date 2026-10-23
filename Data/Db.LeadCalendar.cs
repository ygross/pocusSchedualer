using Dapper;

public partial class Db
{
    // =====================================================
    // LeadCalendar - Queries
    // =====================================================

public async Task<List<(int ActivityId, string ActivityName, string? Department)>> GetLeadCalendarActivitiesAsync(
        DateTime fromUtc, DateTime toUtc, int? courseId = null, int? leadInstructorId = null)
    {
        using var conn = Open();

        const string sql = @"
SELECT DISTINCT
    a.ActivityId,
    a.ActivityName,
    a.Department
FROM dbo.ActivityInstances ai
JOIN dbo.Activities a ON a.ActivityId = ai.ActivityId
WHERE ai.StartUtc >= @fromUtc
  AND ai.StartUtc <  @toUtc
  AND (@courseId IS NULL OR a.CourseId = @courseId)
  AND (@leadInstructorId IS NULL OR a.LeadInstructorId = @leadInstructorId)
ORDER BY a.ActivityName;";

        var rows = await conn.QueryAsync(sql, new { fromUtc, toUtc, courseId, leadInstructorId });
        return rows.Select(r => (
                ActivityId: (int)r.ActivityId,
                ActivityName: (string)r.ActivityName,
                Department: (string?)r.Department
            ))
            .ToList();
    }

public async Task<List<(int InstanceId, int ActivityId, DateTime StartUtc, DateTime EndUtc, string Location, string? Notes)>> GetLeadCalendarInstancesAsync(
        DateTime fromUtc, DateTime toUtc, int? courseId = null, int? leadInstructorId = null)
    {
        using var conn = Open();

        const string sql = @"
SELECT
    ai.InstanceId,
    ai.ActivityId,
    ai.StartUtc,
    ai.EndUtc,
    ISNULL(ai.Location, '''') AS Location,
    ai.Notes
FROM dbo.ActivityInstances ai
JOIN dbo.Activities a ON a.ActivityId = ai.ActivityId
WHERE ai.StartUtc >= @fromUtc
  AND ai.StartUtc <  @toUtc
  AND ai.IsCancelled = 0
  AND (@courseId IS NULL OR a.CourseId = @courseId)
  AND (@leadInstructorId IS NULL OR a.LeadInstructorId = @leadInstructorId)
ORDER BY ai.StartUtc;";

        var rows = await conn.QueryAsync(sql, new { fromUtc, toUtc, courseId, leadInstructorId });
        return rows.Select(r => (
                InstanceId: (int)r.InstanceId,
                ActivityId: (int)r.ActivityId,
                StartUtc: (DateTime)r.StartUtc,
                EndUtc: (DateTime)r.EndUtc,
                Location: (string)r.Location,
                Notes: (string?)r.Notes
            ))
            .ToList();
    }

    public async Task<(int ActivityId, string ActivityName, DateTime StartUtc, DateTime EndUtc, string Location, string? Notes)?> GetInstanceInfoAsync(int instanceId)
    {
        using var conn = Open();

        const string sql = @"
SELECT TOP 1
    ai.ActivityId,
    a.ActivityName,
    ai.StartUtc,
    ai.EndUtc,
    ISNULL(ai.Location, '') AS Location,
    ai.Notes
FROM dbo.ActivityInstances ai
JOIN dbo.Activities a ON a.ActivityId = ai.ActivityId
WHERE ai.InstanceId = @instanceId;";

        var r = await conn.QueryFirstOrDefaultAsync(sql, new { instanceId });
        if (r == null) return null;

        return (
            ActivityId: (int)r.ActivityId,
            ActivityName: (string)r.ActivityName,
            StartUtc: (DateTime)r.StartUtc,
            EndUtc: (DateTime)r.EndUtc,
            Location: (string)r.Location,
            Notes: (string?)r.Notes
        );
    }

    public async Task<List<(string Email, string FullName)>> GetAssignedRecipientsForInstanceAsync(int instanceId)
    {
        using var conn = Open();

        // Check if ActivityInstanceAssignments table exists before querying
        var tableExists = await conn.ExecuteScalarAsync<int>(@"
SELECT COUNT(1) FROM sys.tables WHERE name='ActivityInstanceAssignments';") > 0;

        if (!tableExists) return new List<(string, string)>();

        const string sql = @"
SELECT DISTINCT
    i.Email,
    ISNULL(i.FullName, i.Email) AS FullName
FROM dbo.ActivityInstanceAssignments aia
JOIN dbo.Instructors i ON i.InstructorId = aia.InstructorId
WHERE aia.InstanceId = @instanceId
  AND i.Email IS NOT NULL
ORDER BY i.Email;";

        var rows = await conn.QueryAsync(sql, new { instanceId });
        return rows.Select(r => ((string)r.Email, (string)r.FullName)).ToList();
    }

    // ─── Reminders page helpers ────────────────────────────────────────────────

    /// <summary>
    /// Returns true if the given instructor is the Lead for the activity.
    /// Admins bypass this check in the endpoint layer.
    /// </summary>
    public async Task<bool> IsLeadForActivityAsync(int activityId, int instructorId)
    {
        using var conn = Open();
        const string sql = @"
SELECT COUNT(1) FROM dbo.Activities
WHERE ActivityId = @activityId AND LeadInstructorId = @instructorId;";
        var cnt = await conn.ExecuteScalarAsync<int>(sql, new { activityId, instructorId });
        return cnt > 0;
    }

    /// <summary>
    /// Returns the ActivityId for a given instance — used to validate lead ownership.
    /// </summary>
    public async Task<int?> GetActivityIdForInstanceAsync(int instanceId)
    {
        using var conn = Open();
        const string sql = @"
SELECT TOP 1 ActivityId FROM dbo.ActivityInstances
WHERE InstanceId = @instanceId;";
        var id = await conn.ExecuteScalarAsync<int?>(sql, new { instanceId });
        return id;
    }

    /// <summary>
    /// Returns all instances for a specific activity, sorted by date descending.
    /// Used by the CourseManager Reminders page to populate the instance dropdown.
    /// </summary>
    public async Task<List<(int InstanceId, DateTime StartUtc, DateTime EndUtc, string Location, int AssignedCount)>>
        GetInstancesForActivityAsync(int activityId)
    {
        using var conn = Open();
        const string sql = @"
SELECT
    ai.InstanceId,
    ai.StartUtc,
    ai.EndUtc,
    ISNULL(ai.Location, '') AS Location,
    0                       AS AssignedCount
FROM dbo.ActivityInstances ai
WHERE ai.ActivityId = @activityId
  AND ai.IsCancelled = 0
ORDER BY ai.StartUtc DESC;";

        var rows = await conn.QueryAsync(sql, new { activityId });
        var result = new List<(int, DateTime, DateTime, string, int)>();
        foreach (var r in rows)
        {
            result.Add((
                (int)r.InstanceId,
                (DateTime)r.StartUtc,
                (DateTime)r.EndUtc,
                (string)r.Location,
                (int)r.AssignedCount
            ));
        }
        return result;
    }

    /// <summary>
    /// Returns assigned instructor contacts (email + phone) for an instance.
    /// Joins Users → Instructors by email to retrieve phone for WhatsApp.
    /// </summary>
    public async Task<List<(string Email, string FullName, string? Phone)>>
        GetAssignedInstructorContactsAsync(int instanceId)
    {
        using var conn = Open();

        // Check if ActivityInstanceAssignments table exists
        var tableExists = await conn.ExecuteScalarAsync<int>(@"
SELECT COUNT(1) FROM sys.tables WHERE name='ActivityInstanceAssignments';") > 0;

        if (!tableExists) return new List<(string, string, string?)>();

        const string sql = @"
SELECT DISTINCT
    i.Email,
    ISNULL(i.FullName, i.Email) AS FullName,
    i.Phone
FROM dbo.ActivityInstanceAssignments aia
JOIN dbo.Instructors i ON i.InstructorId = aia.InstructorId
WHERE aia.InstanceId = @instanceId
  AND i.Email IS NOT NULL
ORDER BY i.Email;";

        var rows = await conn.QueryAsync(sql, new { instanceId });
        return rows.Select(r => (
            Email:    (string)r.Email,
            FullName: (string)r.FullName,
            Phone:    (string?)r.Phone
        )).ToList();
    }

    // =====================================================
    // Colors
    // =====================================================

    public static string ColorFromActivityId(int activityId)
    {
        // צבעים “קבועים” לפי ID, כדי שכל פעילות תקבל צבע עקבי.
        var palette = new[]
        {
            "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
            "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
            "#bcbd22", "#17becf"
        };

        var idx = Math.Abs(activityId) % palette.Length;
        return palette[idx];
    }
}

