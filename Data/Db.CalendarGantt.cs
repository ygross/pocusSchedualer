using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Calendar / gantt projections.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Returns gantt items between a time range, with optional filters.
    /// </summary>
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

    /// <summary>
    /// Returns calendar items (instances) between a time range, optionally filtered by activity type.
    /// </summary>
    public async Task<IEnumerable<ActivityCalendarItemDto>> GetActivitiesCalendarAsync(
        DateTime fromUtc,
        DateTime toUtc,
        int? activityTypeId)
    {
        const string sql = @"
SELECT
    inst.InstanceId AS ActivityInstanceId,
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
}
