using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Search / projections (activities, gantt).
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Searches activities with optional filters (id/type/lead/name).
    /// Returns next upcoming instance start time when available.
    /// </summary>
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
}
