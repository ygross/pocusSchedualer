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
    ///
    /// Personalization:
    /// - If <paramref name="myInstructorId"/> is provided (authenticated instructor),
    ///   the result includes:
    ///   - <see cref="ActivityCalendarItemDto.HasAvailability"/>: true if the instructor has submitted availability
    ///     (row exists in dbo.AvailabilityRequests).
    ///   - <see cref="ActivityCalendarItemDto.IsAssignedToMe"/>: true if the instructor is assigned (Approved and not cancelled).
    ///
    /// Authorization/UI rule:
    /// - If IsAssignedToMe == true => UI should render green and lock actions (no propose/cancel).
    /// - Else if HasAvailability == true => UI should render brown and show "Cancel availability".
    /// - Else => UI should render blue and show "Propose availability".
    ///
    /// Visibility rule (your request):
    /// - Instructors should see only activities they are certified for.
    ///   Certification mapping is dbo.InstructorCourses (CourseId <-> InstructorId).
    /// - Admin usage may call with myInstructorId = null to see all activities.
    /// </summary>
    /// <param name="fromUtc">Start (UTC).</param>
    /// <param name="toUtc">End (UTC, exclusive).</param>
    /// <param name="activityTypeId">Optional activity type filter.</param>
    /// <param name="myInstructorId">Authenticated instructor id for personalization & certification filter.</param>
    public async Task<IEnumerable<ActivityCalendarItemDto>> GetActivitiesCalendarAsync(
        DateTime fromUtc,
        DateTime toUtc,
        int? activityTypeId,
        int? myInstructorId)
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
    inst.EndUtc,
    ISNULL(inst.RoomsCount, 0) AS RoomsCount,
    ISNULL(inst.RequiredInstructors, 0) AS RequiredInstructors,
    (
        SELECT COUNT(1)
        FROM dbo.Assignments ax
        WHERE ax.InstanceId = inst.InstanceId
          AND ax.Status='Approved'
          AND (ax.CancelledAtUtc IS NULL)
    ) AS AssignedInstructors,

    CASE WHEN @myInstructorId IS NOT NULL AND EXISTS (
        SELECT 1 FROM dbo.AvailabilityRequests ar
        WHERE ar.InstanceId = inst.InstanceId
          AND ar.InstructorId = @myInstructorId
    ) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS HasAvailability,

    CASE WHEN @myInstructorId IS NOT NULL AND EXISTS (
        SELECT 1 FROM dbo.Assignments am
        WHERE am.InstanceId = inst.InstanceId
          AND am.InstructorId = @myInstructorId
          AND am.Status='Approved'
          AND (am.CancelledAtUtc IS NULL)
    ) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS IsAssignedToMe

FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
JOIN dbo.ActivityTypes t ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
LEFT JOIN dbo.Instructors i ON i.InstructorId = a.LeadInstructorId
WHERE inst.StartUtc >= @fromUtc
  AND inst.StartUtc <  @toUtc
  AND (@activityTypeId IS NULL OR a.ActivityTypeId = @activityTypeId)

  -- ✅ Certification filter (your requirement):
  -- If myInstructorId is provided => show only activities whose CourseId is mapped to the instructor in InstructorCourses.
  AND (
        @myInstructorId IS NULL
        OR EXISTS (
            SELECT 1
            FROM dbo.InstructorCourses ic
            WHERE ic.CourseId = a.CourseId
              AND ic.InstructorId = @myInstructorId
        )
      )

ORDER BY inst.StartUtc;";

        await using var c2 = Open();
        return await c2.QueryAsync<ActivityCalendarItemDto>(sql, new
        {
            fromUtc,
            toUtc,
            activityTypeId,
            myInstructorId
        });
    }
}
