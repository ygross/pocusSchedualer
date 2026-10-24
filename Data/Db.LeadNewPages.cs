using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

public sealed partial class Db
{
    // ── Pending Availability ───────────────────────────────────────────────────
    /// <summary>
    /// Returns future instances that have at least one 'Pending' availability request
    /// (i.e. instructor was asked but has not yet responded).
    /// Pass null leadId to return all (Admin); pass a value to scope to one lead.
    /// </summary>
    public async Task<List<LeadPendingAvailDto>> GetLeadPendingAvailabilityAsync(int? leadId, int? courseId = null)
    {
        const string sql = @"
SELECT
    a.ActivityId,
    a.ActivityName,
    ai.InstanceId,
    ai.StartUtc,
    ai.EndUtc,
    ai.RequiredInstructors,
    COUNT(ar.AvailabilityId)                                             AS TotalRequested,
    SUM(CASE WHEN ar.Status = 'Pending'   THEN 1 ELSE 0 END)           AS StillPending,
    SUM(CASE WHEN ar.Status IN ('Available','Unavailable') THEN 1 ELSE 0 END) AS Responded,
    SUM(CASE WHEN ar.Status = 'Unavailable' THEN 1 ELSE 0 END)         AS Declined
FROM dbo.AvailabilityRequests ar
JOIN dbo.ActivityInstances ai ON ai.InstanceId = ar.InstanceId
JOIN dbo.Activities        a  ON a.ActivityId  = ai.ActivityId
WHERE a.IsCancelled  = 0
  AND ai.IsCancelled = 0
  AND ai.StartUtc    > GETUTCDATE()
  AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
  AND (@courseId IS NULL OR a.CourseId = @courseId)
GROUP BY a.ActivityId, a.ActivityName, ai.InstanceId, ai.StartUtc, ai.EndUtc, ai.RequiredInstructors
HAVING SUM(CASE WHEN ar.Status = 'Pending' THEN 1 ELSE 0 END) > 0
ORDER BY ai.StartUtc;";

        await using var c = Open();
        return (await c.QueryAsync<LeadPendingAvailDto>(sql, new { leadId, courseId })).AsList();
    }

    // ── Needs Attention (understaffed future instances) ───────────────────────
    /// <summary>
    /// Returns future instances where approved assignment count is below required.
    /// Includes count of available (but not yet approved) instructors and recent cancellations.
    /// </summary>
    public async Task<List<LeadNeedsAttentionDto>> GetLeadNeedsAttentionAsync(int? leadId, int? courseId = null)
    {
        const string sql = @"
SELECT
    a.ActivityId,
    a.ActivityName,
    ai.InstanceId,
    ai.StartUtc,
    ai.EndUtc,
    ai.RequiredInstructors,
    (SELECT COUNT(1) FROM dbo.Assignments s
     WHERE s.InstanceId = ai.InstanceId AND s.Status = 'Approved')                                         AS AssignedCount,
    (SELECT COUNT(1) FROM dbo.AvailabilityRequests ar
     WHERE ar.InstanceId = ai.InstanceId AND ar.Status = 'Available')                                      AS AvailableCount,
    (SELECT COUNT(1) FROM dbo.Assignments s2
     WHERE s2.InstanceId = ai.InstanceId AND s2.Status = 'Cancelled'
       AND s2.CancelledAtUtc > DATEADD(day, -7, GETUTCDATE()))                                             AS RecentCancellations
FROM dbo.Activities        a
JOIN dbo.ActivityInstances ai ON ai.ActivityId = a.ActivityId AND ai.IsCancelled = 0
WHERE a.IsCancelled = 0
  AND ai.StartUtc   > GETUTCDATE()
  AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
  AND (@courseId IS NULL OR a.CourseId = @courseId)
  AND (SELECT COUNT(1) FROM dbo.Assignments s
       WHERE s.InstanceId = ai.InstanceId AND s.Status = 'Approved') < ai.RequiredInstructors
ORDER BY ai.StartUtc;";

        await using var c = Open();
        return (await c.QueryAsync<LeadNeedsAttentionDto>(sql, new { leadId, courseId })).AsList();
    }

    // ── Conflict Report (overlapping assignments) ─────────────────────────────
    /// <summary>
    /// Returns pairs of assignments for the same instructor whose instances overlap in time.
    /// Scoped to the lead's activities when leadId is provided.
    /// </summary>
    public async Task<List<LeadConflictDto>> GetLeadConflictsAsync(int? leadId, int? courseId = null)
    {
        const string sql = @"
SELECT
    i.InstructorId,
    i.FullName,
    a1.ActivityName AS Activity1,
    ai1.InstanceId  AS InstanceId1,
    ai1.StartUtc    AS Start1,
    ai1.EndUtc      AS End1,
    a2.ActivityName AS Activity2,
    ai2.InstanceId  AS InstanceId2,
    ai2.StartUtc    AS Start2,
    ai2.EndUtc      AS End2
FROM dbo.Assignments        asgn1
JOIN dbo.Assignments        asgn2  ON asgn2.InstructorId = asgn1.InstructorId
                                   AND asgn2.AssignmentId > asgn1.AssignmentId
                                   AND asgn2.Status = 'Approved'
JOIN dbo.ActivityInstances  ai1    ON ai1.InstanceId = asgn1.InstanceId
JOIN dbo.ActivityInstances  ai2    ON ai2.InstanceId = asgn2.InstanceId
JOIN dbo.Activities         a1     ON a1.ActivityId  = ai1.ActivityId
JOIN dbo.Activities         a2     ON a2.ActivityId  = ai2.ActivityId
JOIN dbo.Instructors        i      ON i.InstructorId = asgn1.InstructorId
WHERE asgn1.Status   = 'Approved'
  AND ai1.IsCancelled = 0
  AND ai2.IsCancelled = 0
  AND a1.IsCancelled  = 0
  AND a2.IsCancelled  = 0
  AND ai1.StartUtc    < ai2.EndUtc
  AND ai1.EndUtc      > ai2.StartUtc
  AND ai1.StartUtc    > DATEADD(day, -1, GETUTCDATE())
  AND (@leadId IS NULL OR a1.LeadInstructorId = @leadId OR a2.LeadInstructorId = @leadId)
  AND (@courseId IS NULL OR a1.CourseId = @courseId OR a2.CourseId = @courseId)
ORDER BY i.FullName, ai1.StartUtc;";

        await using var c = Open();
        return (await c.QueryAsync<LeadConflictDto>(sql, new { leadId, courseId })).AsList();
    }
}
