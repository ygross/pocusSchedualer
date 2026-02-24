using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Instructor assignments read model.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Returns all active approved assignments for a given instructor,
    /// enriched with activity/instance details. Ordered by instance start time descending.
    /// </summary>
    /// <param name="instructorId">The logged-in instructor's ID.</param>
    /// <param name="fromUtc">Optional: only return instances starting after this date (UTC).</param>
    /// <param name="toUtc">Optional: only return instances starting before this date (UTC).</param>
    public async Task<IEnumerable<MyAssignmentDto>> GetMyAssignmentsAsync(
        int instructorId,
        DateTime? fromUtc = null,
        DateTime? toUtc = null)
    {
        const string sql = @"
SELECT
    ass.AssignmentId,
    ass.Status,
    ass.AssignedAtUtc,

    inst.InstanceId,
    inst.StartUtc,
    inst.EndUtc,
    ISNULL(inst.RoomsCount, 0)          AS RoomsCount,
    ISNULL(inst.RequiredInstructors, 0) AS RequiredInstructors,

    a.ActivityId,
    a.ActivityName,
    t.TypeName,
    c.CourseName,

    a.LeadInstructorId,
    lead.FullName AS LeadInstructorName

FROM dbo.Assignments ass
JOIN dbo.ActivityInstances inst ON inst.InstanceId = ass.InstanceId
JOIN dbo.Activities         a    ON a.ActivityId   = inst.ActivityId
JOIN dbo.ActivityTypes      t    ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses        c    ON c.CourseId     = a.CourseId
LEFT JOIN dbo.Instructors    lead ON lead.InstructorId = a.LeadInstructorId

WHERE ass.InstructorId    = @instructorId
  AND ass.Status          = 'Approved'
  AND ass.CancelledAtUtc IS NULL
  AND inst.IsCancelled   = 0
  AND a.IsCancelled      = 0
  AND (@fromUtc IS NULL OR inst.StartUtc >= @fromUtc)
  AND (@toUtc   IS NULL OR inst.StartUtc <  @toUtc)

ORDER BY inst.StartUtc DESC;";

        await using var c = Open();
        return await c.QueryAsync<MyAssignmentDto>(sql, new { instructorId, fromUtc, toUtc });
    }
}
