using Dapper;

// ── DTOs ────────────────────────────────────────────────────────────────────

public sealed class CenterSummaryDto
{
    public int     TypesCount      { get; set; }
    public int     CoursesCount    { get; set; }
    public int     ActivitiesCount { get; set; }
    public int     InstancesCount  { get; set; }
    public decimal TotalHours      { get; set; }
}

public sealed class CenterTypeStatDto
{
    public string  TypeName         { get; set; } = "";
    public int     CoursesCount     { get; set; }
    public int     ActivitiesCount  { get; set; }
    public decimal TotalHours       { get; set; }
}

public sealed class ActivityTypeNodeDto
{
    public int    ActivityTypeId { get; set; }
    public string TypeName       { get; set; } = "";
    public List<CourseNodeDto> Courses { get; set; } = new();
}

public sealed class CourseNodeDto
{
    public int    CourseId         { get; set; }
    public string CourseName       { get; set; } = "";
    public bool   IsActive         { get; set; }
    public int    InstructorsCount { get; set; }
    public List<ActivityNodeDto> Activities { get; set; } = new();
}

public sealed class ActivityNodeDto
{
    public int     ActivityId   { get; set; }
    public string  ActivityName { get; set; } = "";
    public int     InstanceCount { get; set; }
    public decimal TotalHours   { get; set; }
}

// ── Flat rows for Dapper ────────────────────────────────────────────────────

file sealed class TypeRow
{
    public int    ActivityTypeId { get; set; }
    public string TypeName       { get; set; } = "";
}

file sealed class CourseRow
{
    public int    CourseId         { get; set; }
    public string CourseName       { get; set; } = "";
    public int    ActivityTypeId   { get; set; }
    public bool   IsActive         { get; set; }
    public int    InstructorsCount { get; set; }
}

file sealed class ActivityRow
{
    public int     ActivityId    { get; set; }
    public string  ActivityName  { get; set; } = "";
    public int?    CourseId      { get; set; }
    public int     InstanceCount { get; set; }
    public decimal TotalHours    { get; set; }
}

// ── Db partial ──────────────────────────────────────────────────────────────

public sealed partial class Db
{
    public async Task<(CenterSummaryDto Summary, List<CenterTypeStatDto> ByType)> GetCenterStatsAsync()
    {
        const string sql = @"
SELECT
    (SELECT COUNT(*)    FROM dbo.ActivityTypes)                AS TypesCount,
    (SELECT COUNT(*)    FROM dbo.Courses      WHERE IsActive=1) AS CoursesCount,
    (SELECT COUNT(*)    FROM dbo.Activities)                   AS ActivitiesCount,
    (SELECT COUNT(*)    FROM dbo.ActivityInstances WHERE IsCancelled=0) AS InstancesCount,
    ISNULL((SELECT CAST(SUM(DATEDIFF(MINUTE,StartUtc,EndUtc)) AS decimal(18,2))/60.0
            FROM dbo.ActivityInstances WHERE IsCancelled=0), 0) AS TotalHours;

SELECT
    at.TypeName,
    COUNT(DISTINCT c.CourseId)    AS CoursesCount,
    COUNT(DISTINCT a.ActivityId)  AS ActivitiesCount,
    ISNULL(CAST(SUM(DATEDIFF(MINUTE,i.StartUtc,i.EndUtc)) AS decimal(18,2))/60.0, 0) AS TotalHours
FROM dbo.ActivityTypes at
LEFT JOIN dbo.Courses           c  ON c.ActivityTypeId=at.ActivityTypeId AND c.IsActive=1
LEFT JOIN dbo.Activities        a  ON a.CourseId=c.CourseId
LEFT JOIN dbo.ActivityInstances i  ON i.ActivityId=a.ActivityId AND i.IsCancelled=0
GROUP BY at.ActivityTypeId, at.TypeName
ORDER BY at.TypeName;";

        await using var conn = Open();
        using var multi = await conn.QueryMultipleAsync(sql);
        var summary = await multi.ReadFirstOrDefaultAsync<CenterSummaryDto>() ?? new CenterSummaryDto();
        var byType  = (await multi.ReadAsync<CenterTypeStatDto>()).ToList();
        return (summary, byType);
    }

    public async Task<List<ActivityTypeNodeDto>> GetActivityTreeAsync()
    {
        const string sql = @"
SELECT ActivityTypeId, TypeName
FROM dbo.ActivityTypes
ORDER BY TypeName;

SELECT c.CourseId, c.CourseName, c.ActivityTypeId, c.IsActive,
       COUNT(DISTINCT ic.InstructorId) AS InstructorsCount
FROM dbo.Courses c
LEFT JOIN dbo.InstructorCourses ic ON ic.CourseId=c.CourseId
GROUP BY c.CourseId, c.CourseName, c.ActivityTypeId, c.IsActive
ORDER BY c.CourseName;

SELECT a.ActivityId, a.ActivityName, a.CourseId,
       COUNT(DISTINCT i.InstanceId) AS InstanceCount,
       ISNULL(CAST(SUM(DATEDIFF(MINUTE,i.StartUtc,i.EndUtc)) AS decimal(18,2))/60.0, 0) AS TotalHours
FROM dbo.Activities a
LEFT JOIN dbo.ActivityInstances i ON i.ActivityId=a.ActivityId AND i.IsCancelled=0
GROUP BY a.ActivityId, a.ActivityName, a.CourseId
ORDER BY a.ActivityName;";

        await using var conn = Open();
        using var multi = await conn.QueryMultipleAsync(sql);

        var types      = (await multi.ReadAsync<TypeRow>()).ToList();
        var courses    = (await multi.ReadAsync<CourseRow>()).ToList();
        var activities = (await multi.ReadAsync<ActivityRow>()).ToList();

        var actByCourse = activities
            .GroupBy(a => a.CourseId ?? 0)
            .ToDictionary(g => g.Key, g => g.Select(a => new ActivityNodeDto
            {
                ActivityId   = a.ActivityId,
                ActivityName = a.ActivityName,
                InstanceCount = a.InstanceCount,
                TotalHours   = a.TotalHours
            }).ToList());

        var courseByType = courses
            .GroupBy(c => c.ActivityTypeId)
            .ToDictionary(g => g.Key, g => g.Select(c => new CourseNodeDto
            {
                CourseId         = c.CourseId,
                CourseName       = c.CourseName,
                IsActive         = c.IsActive,
                InstructorsCount = c.InstructorsCount,
                Activities       = actByCourse.GetValueOrDefault(c.CourseId) ?? new()
            }).ToList());

        return types.Select(t => new ActivityTypeNodeDto
        {
            ActivityTypeId = t.ActivityTypeId,
            TypeName       = t.TypeName,
            Courses        = courseByType.GetValueOrDefault(t.ActivityTypeId) ?? new()
        }).ToList();
    }
}
