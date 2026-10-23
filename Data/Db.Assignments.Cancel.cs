using System;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Instructor self-cancellation of an approved assignment.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Cancels an assignment on behalf of the instructor.
    /// Only allows cancellation if:
    ///   - The assignment belongs to the instructor
    ///   - Status = 'Approved' and CancelledAtUtc IS NULL
    ///   - The instance has not yet started (StartUtc > NOW)
    /// Returns true if a row was updated.
    /// </summary>
    public async Task<bool> CancelInstructorAssignmentAsync(int assignmentId, int instructorId)
    {
        const string sql = @"
UPDATE dbo.Assignments
SET CancelledAtUtc = SYSUTCDATETIME()
WHERE AssignmentId  = @assignmentId
  AND InstructorId  = @instructorId
  AND Status        = 'Approved'
  AND CancelledAtUtc IS NULL
  AND EXISTS (
      SELECT 1
      FROM dbo.ActivityInstances inst
      WHERE inst.InstanceId = dbo.Assignments.InstanceId
        AND inst.StartUtc > SYSUTCDATETIME()
  );";

        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new { assignmentId, instructorId });
        return rows > 0;
    }

    /// <summary>
    /// Returns the AssignmentId for an instructor's active assignment on an instance.
    /// Returns null if not found.
    /// </summary>
    public async Task<int?> GetMyAssignmentIdAsync(int instanceId, int instructorId)
    {
        const string sql = @"
SELECT TOP 1 AssignmentId
FROM dbo.Assignments
WHERE InstanceId    = @instanceId
  AND InstructorId  = @instructorId
  AND Status        = 'Approved'
  AND CancelledAtUtc IS NULL;";

        await using var c = Open();
        var id = await c.ExecuteScalarAsync<int?>(sql, new { instanceId, instructorId });
        return id;
    }
}
