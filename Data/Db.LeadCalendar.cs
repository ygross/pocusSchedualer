using Dapper;

public partial class Db
{
    // =====================================================
    // LeadCalendar - Queries
    // =====================================================

    public async Task<List<(int ActivityId, string ActivityName, string? Department)>> GetLeadCalendarActivitiesAsync(
        DateTime fromUtc, DateTime toUtc)
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
ORDER BY a.ActivityName;";

        var rows = await conn.QueryAsync(sql, new { fromUtc, toUtc });
        return rows.Select(r => (
                ActivityId: (int)r.ActivityId,
                ActivityName: (string)r.ActivityName,
                Department: (string?)r.Department
            ))
            .ToList();
    }

    public async Task<List<(int InstanceId, int ActivityId, DateTime StartUtc, DateTime EndUtc, string Location, string? Notes)>> GetLeadCalendarInstancesAsync(
        DateTime fromUtc, DateTime toUtc)
    {
        using var conn = Open();

        const string sql = @"
SELECT
    ai.ActivityInstanceId AS InstanceId,
    ai.ActivityId,
    ai.StartUtc,
    ai.EndUtc,
    ISNULL(ai.Location, '') AS Location,
    ai.Notes
FROM dbo.ActivityInstances ai
WHERE ai.StartUtc >= @fromUtc
  AND ai.StartUtc <  @toUtc
ORDER BY ai.StartUtc;";

        var rows = await conn.QueryAsync(sql, new { fromUtc, toUtc });
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
WHERE ai.ActivityInstanceId = @instanceId;";

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

        // NOTE: התאמה לפי הטבלאות הקיימות אצלך (Assignments/Users)
        // אם שמות הטבלאות/עמודות אצלך שונים — זה המקום היחיד לשנות.
        const string sql = @"
SELECT DISTINCT
    u.Email,
    ISNULL(u.FullName, u.Email) AS FullName
FROM dbo.ActivityInstanceAssignments aia
JOIN dbo.Users u ON u.UserId = aia.UserId
WHERE aia.ActivityInstanceId = @instanceId
  AND aia.IsAssigned = 1
  AND u.Email IS NOT NULL
ORDER BY u.Email;";

        var rows = await conn.QueryAsync(sql, new { instanceId });
        return rows.Select(r => ((string)r.Email, (string)r.FullName)).ToList();
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
