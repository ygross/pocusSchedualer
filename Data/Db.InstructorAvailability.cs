using System;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Instructor self-availability actions for an activity instance.
/// This supports the instructor calendar UI: offer availability / cancel availability,
/// with a hard lock if the instructor is already assigned.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Returns true if the instructor has an ACTIVE approved assignment for the instance.
    /// An assigned instructor is considered "locked" in the UI (green) and cannot offer/cancel availability.
    /// </summary>
    /// <param name="instanceId">Activity instance id.</param>
    /// <param name="instructorId">Authenticated instructor id (from claims).</param>
    /// <returns>True if an approved assignment exists and is not cancelled.</returns>
    public async Task<bool> IsInstructorAssignedToInstanceAsync(int instanceId, int instructorId)
    {
        const string sql = @"
SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM dbo.Assignments a
    WHERE a.InstanceId = @instanceId
      AND a.InstructorId = @instructorId
      AND a.Status = 'Approved'
      AND (a.CancelledAtUtc IS NULL)
) THEN 1 ELSE 0 END;";

        await using var c = Open();
        var v = await c.ExecuteScalarAsync<int>(sql, new { instanceId, instructorId });
        return v == 1;
    }

    /// <summary>
    /// Upserts (creates if missing) an availability request for an instructor for an instance.
    /// If the row exists, updates SubmittedAtUtc.
    /// NOTE: This is the "instructor offers availability" action.
    /// </summary>
    /// <param name="instanceId">Activity instance id.</param>
    /// <param name="instructorId">Authenticated instructor id (from claims).</param>
    /// <returns>A task that completes when the DB operation finishes.</returns>
    public async Task UpsertInstructorAvailabilityAsync(int instanceId, int instructorId)
    {
        // If your schema requires Status values, keep it simple: use 'Submitted' (or your chosen value).
        // If your system already uses only 'Approved' for lead decisions,
        // you can still store a 'Submitted' status to represent "offered availability".
        const string sql = @"
MERGE dbo.AvailabilityRequests WITH (HOLDLOCK) AS t
USING (VALUES (@instanceId, @instructorId)) AS s(InstanceId, InstructorId)
  ON t.InstanceId = s.InstanceId AND t.InstructorId = s.InstructorId
WHEN MATCHED THEN
  UPDATE SET SubmittedAtUtc = SYSUTCDATETIME(),
             Status = ISNULL(NULLIF(t.Status,''),'Submitted')
WHEN NOT MATCHED THEN
  INSERT (InstanceId, InstructorId, Status, SubmittedAtUtc)
  VALUES (@instanceId, @instructorId, 'Submitted', SYSUTCDATETIME());";

        await using var c = Open();
        await c.ExecuteAsync(sql, new { instanceId, instructorId });
    }

    /// <summary>
    /// Returns the effective deadline for offering availability on an instance.
    /// Uses ApplicationDeadlineUtc if set, otherwise StartUtc minus <paramref name="fallbackDays"/>.
    /// Returns null if the instance does not exist.
    /// </summary>
    public async Task<DateTime?> GetInstanceDeadlineAsync(int instanceId, int fallbackDays)
    {
        const string sql = @"
SELECT ISNULL(
    a.ApplicationDeadlineUtc,
    DATEADD(DAY, -@fallbackDays, inst.StartUtc)
)
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
WHERE inst.InstanceId = @instanceId;";

        await using var c = Open();
        return await c.ExecuteScalarAsync<DateTime?>(sql, new { instanceId, fallbackDays });
    }

    /// <summary>
    /// Cancels an instructor availability request for an instance.
    /// Implementation choice: hard delete the row (simple & consistent with your existing instance delete cascade).
    /// </summary>
    /// <param name="instanceId">Activity instance id.</param>
    /// <param name="instructorId">Authenticated instructor id (from claims).</param>
    /// <returns>A task that completes when the DB operation finishes.</returns>
    public async Task DeleteInstructorAvailabilityAsync(int instanceId, int instructorId)
    {
        const string sql = @"
DELETE FROM dbo.AvailabilityRequests
WHERE InstanceId=@instanceId AND InstructorId=@instructorId;";

        await using var c = Open();
        await c.ExecuteAsync(sql, new { instanceId, instructorId });
    }
}
