using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Pull-model availability requests: Lead sends formal requests to instructors,
/// instructors confirm or decline via the UI/email link.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Creates AvailabilityRequest rows (Status='Requested') for the given instructors on an instance.
    /// Skips any instructor who already has a row for this instance (any status).
    /// Returns the number of rows actually inserted.
    /// </summary>
    public async Task<int> CreateAvailabilityRequestsAsync(
        int instanceId,
        int[] instructorIds,
        int requestedBy)
    {
        const string sql = @"
IF NOT EXISTS (
    SELECT 1 FROM dbo.AvailabilityRequests
    WHERE InstanceId = @instanceId AND InstructorId = @instructorId
)
BEGIN
    INSERT INTO dbo.AvailabilityRequests (InstanceId, InstructorId, Status, SubmittedAtUtc)
    VALUES (@instanceId, @instructorId, 'Requested', SYSUTCDATETIME());
END";

        await using var c = Open();
        await using var tx = await c.BeginTransactionAsync();
        var inserted = 0;
        foreach (var iid in instructorIds)
        {
            inserted += await c.ExecuteAsync(sql, new { instanceId, instructorId = iid }, tx);
        }
        await tx.CommitAsync();
        return inserted;
    }

    /// <summary>
    /// Instructor responds to a 'Requested' availability request.
    /// accept=true  → Status becomes 'Submitted' (I'm available)
    /// accept=false → Status becomes 'Rejected'  (I can't make it)
    /// Returns true if the row was found and updated.
    /// </summary>
    public async Task<bool> RespondToAvailabilityRequestAsync(
        int availabilityId,
        int instructorId,
        bool accept,
        string? note)
    {
        const string sql = @"
UPDATE dbo.AvailabilityRequests
SET Status                  = CASE WHEN @accept = 1 THEN 'Submitted' ELSE 'Rejected' END,
    DecisionAtUtc           = SYSUTCDATETIME(),
    DecisionNote            = @note,
    DecisionByInstructorId  = @instructorId
WHERE AvailabilityId  = @availabilityId
  AND InstructorId    = @instructorId
  AND Status          = 'Requested';";

        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new { availabilityId, instructorId, accept = accept ? 1 : 0, note });
        return rows > 0;
    }

    /// <summary>
    /// Returns all 'Requested' availability rows for an instructor, with instance and activity details.
    /// Used by the instructor activities list page to show pending requests.
    /// </summary>
    public async Task<IEnumerable<PendingAvailabilityRequestDto>> GetMyPendingAvailabilityRequestsAsync(int instructorId)
    {
        const string sql = @"
SELECT
    ar.AvailabilityId,
    ar.InstanceId,
    a.ActivityName,
    inst.StartUtc,
    inst.EndUtc,
    lead.FullName AS LeadInstructorName,
    ar.Status,
    ar.SubmittedAtUtc
FROM dbo.AvailabilityRequests ar
JOIN dbo.ActivityInstances inst ON inst.InstanceId = ar.InstanceId
JOIN dbo.Activities a           ON a.ActivityId    = inst.ActivityId
LEFT JOIN dbo.Instructors lead  ON lead.InstructorId = a.LeadInstructorId
WHERE ar.InstructorId = @instructorId
  AND ar.Status       = 'Requested'
ORDER BY inst.StartUtc;";

        await using var c = Open();
        return await c.QueryAsync<PendingAvailabilityRequestDto>(sql, new { instructorId });
    }

    /// <summary>
    /// Returns instructor emails for those who have a 'Requested' row for the given instance.
    /// Used by the endpoint to send request emails.
    /// </summary>
    public async Task<IEnumerable<(int InstructorId, string? Email, string? FullName, string? Phone)>> GetRequestedInstructorContactsAsync(
        int instanceId,
        int[] instructorIds)
    {
        const string sql = @"
SELECT i.InstructorId, i.Email, i.FullName, i.Phone
FROM dbo.Instructors i
JOIN dbo.AvailabilityRequests ar
    ON ar.InstructorId = i.InstructorId
   AND ar.InstanceId   = @instanceId
   AND ar.Status       = 'Requested'
WHERE i.InstructorId IN @instructorIds;";

        await using var c = Open();
        var rows = await c.QueryAsync(sql, new { instanceId, instructorIds });
        var result = new List<(int, string?, string?, string?)>();
        foreach (var r in rows)
            result.Add(((int)r.InstructorId, (string?)r.Email, (string?)r.FullName, (string?)r.Phone));
        return result;
    }

    /// <summary>
    /// Returns lead contact info + activity/instance details for a given instance.
    /// Used to notify the lead when an instructor responds.
    /// </summary>
    public async Task<LeadInstanceInfoDto?> GetLeadInfoForInstanceAsync(int instanceId)
    {
        const string sql = @"
SELECT
    lead.InstructorId  AS LeadInstructorId,
    lead.FullName      AS LeadFullName,
    lead.Email         AS LeadEmail,
    lead.Phone         AS LeadPhone,
    a.ActivityName,
    inst.StartUtc,
    inst.EndUtc
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a         ON a.ActivityId      = inst.ActivityId
JOIN dbo.Instructors lead     ON lead.InstructorId  = a.LeadInstructorId
WHERE inst.InstanceId = @instanceId;";

        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<LeadInstanceInfoDto>(sql, new { instanceId });
    }

    /// <summary>Returns the InstanceId for a given AvailabilityId.</summary>
    public async Task<int> GetInstanceIdForAvailabilityAsync(int availabilityId)
    {
        await using var c = Open();
        return await c.ExecuteScalarAsync<int>(
            "SELECT ISNULL(InstanceId,0) FROM dbo.AvailabilityRequests WHERE AvailabilityId=@availabilityId;",
            new { availabilityId });
    }

    /// <summary>Returns FullName for an instructor.</summary>
    public async Task<string?> GetInstructorNameAsync(int instructorId)
    {
        await using var c = Open();
        return await c.ExecuteScalarAsync<string?>(
            "SELECT FullName FROM dbo.Instructors WHERE InstructorId=@instructorId;",
            new { instructorId });
    }

    /// <summary>
    /// Returns availability status counts for an instance (for lead dashboard).
    /// </summary>
    public async Task<InstanceAvailabilityCountsDto> GetInstanceAvailabilityCountsAsync(int instanceId)
    {
        const string sql = @"
SELECT
    COUNT(CASE WHEN ar.Status='Requested' THEN 1 END) AS Requested,
    COUNT(CASE WHEN ar.Status='Submitted' THEN 1 END) AS Submitted,
    COUNT(CASE WHEN ar.Status='Rejected'  THEN 1 END) AS Rejected,
    COUNT(CASE WHEN ass.AssignmentId IS NOT NULL AND ass.CancelledAtUtc IS NULL THEN 1 END) AS Assigned
FROM dbo.AvailabilityRequests ar
LEFT JOIN dbo.Assignments ass
    ON ass.InstanceId   = ar.InstanceId
   AND ass.InstructorId = ar.InstructorId
   AND ass.Status       = 'Approved'
   AND ass.CancelledAtUtc IS NULL
WHERE ar.InstanceId = @instanceId;";

        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<InstanceAvailabilityCountsDto>(sql, new { instanceId })
               ?? new InstanceAvailabilityCountsDto();
    }
}

public sealed class LeadInstanceInfoDto
{
    public int LeadInstructorId { get; set; }
    public string? LeadFullName { get; set; }
    public string? LeadEmail    { get; set; }
    public string? LeadPhone    { get; set; }
    public string ActivityName  { get; set; } = "";
    public DateTime StartUtc    { get; set; }
    public DateTime EndUtc      { get; set; }
}

public sealed class InstanceAvailabilityCountsDto
{
    public int Requested { get; set; }
    public int Submitted { get; set; }
    public int Rejected  { get; set; }
    public int Assigned  { get; set; }
}
