using System;
using System.Threading.Tasks;
using Dapper;

public sealed partial class Db
{
    /// <summary>
    /// Creates a new activity + instances in a single transaction.
    /// Uses CreatedByInstructorId from the authenticated actor (NOT from client).
    /// Matches DB JSON required columns (IsCancelled, CreatedAtUtc, UpdatedAtUtc).
    /// </summary>
    public async Task<(bool Ok, int ActivityId, string? Error)> CreateActivityWithInstancesAsync(
        string activityName,
        int activityTypeId,
        int courseId,
        int leadInstructorId,
        DateTime? applicationDeadlineUtc,
        int createdByInstructorId,
        System.Collections.Generic.IEnumerable<(DateTime StartUtc, DateTime EndUtc, int RoomsCount, int RequiredInstructors)> instances)
    {
        // Validation (aligned with your UpdateActivityAsync validations)
        if (string.IsNullOrWhiteSpace(activityName)) return (false, 0, "ActivityName is required");
        if (activityTypeId <= 0) return (false, 0, "ActivityTypeId is required");
        if (courseId <= 0) return (false, 0, "CourseId is required");
        if (leadInstructorId <= 0) return (false, 0, "LeadInstructorId is required");

        // Instances must exist
        bool any = false;
        foreach (var _ in instances) { any = true; break; }
        if (!any) return (false, 0, "At least one instance is required");

        const string sqlInsertActivity = @"
INSERT INTO dbo.Activities
(
  ActivityName,
  ActivityTypeId,
  Department,
  CourseId,
  ApplicationDeadlineUtc,
  CreatedByInstructorId,
  IsCancelled,
  CancelReason,
  CreatedAtUtc,
  UpdatedAtUtc,
  LeadInstructorId
)
OUTPUT INSERTED.ActivityId
VALUES
(
  @ActivityName,
  @ActivityTypeId,
  @Department,
  @CourseId,
  @ApplicationDeadlineUtc,
  @CreatedByInstructorId,
  0,
  NULL,
  SYSUTCDATETIME(),
  SYSUTCDATETIME(),
  @LeadInstructorId
);";

        // ✅ FIX: insert ALL required columns per DB JSON
        const string sqlInsertInstance = @"
INSERT INTO dbo.ActivityInstances
(
  ActivityId,
  StartUtc,
  EndUtc,
  RequiredInstructors,
  RoomsCount,
  IsCancelled,
  CancelReason,
  CreatedAtUtc,
  UpdatedAtUtc
)
VALUES
(
  @ActivityId,
  @StartUtc,
  @EndUtc,
  @RequiredInstructors,
  @RoomsCount,
  0,
  NULL,
  SYSUTCDATETIME(),
  SYSUTCDATETIME()
);";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            var newActivityId = await c.QuerySingleAsync<int>(sqlInsertActivity, new
            {
                ActivityName = activityName.Trim(),
                ActivityTypeId = activityTypeId,
                Department = "", // you can later expose/derive if needed
                CourseId = courseId,
                ApplicationDeadlineUtc = applicationDeadlineUtc,
                CreatedByInstructorId = createdByInstructorId,
                LeadInstructorId = leadInstructorId
            }, tx);

            foreach (var inst in instances)
            {
                // sanity checks (optional but good)
                if (inst.EndUtc <= inst.StartUtc)
                {
                    tx.Rollback();
                    return (false, 0, "Instance EndUtc must be after StartUtc");
                }

                await c.ExecuteAsync(sqlInsertInstance, new
                {
                    ActivityId = newActivityId,
                    inst.StartUtc,
                    inst.EndUtc,
                    inst.RequiredInstructors,
                    inst.RoomsCount
                }, tx);
            }

            tx.Commit();
            return (true, newActivityId, null);
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return (false, 0, "DB error: " + ex.Message);
        }
    }

    // -----------------------------------------------------
    // Convenience overloads to reuse your existing DTOs
    // -----------------------------------------------------

    /// <summary>
    /// Uses existing ActivityCreateDto (from ActivityCoreDtos.cs).
    /// </summary>
    public Task<(bool Ok, int ActivityId, string? Error)> CreateActivityWithInstancesAsync(
        ActivityCreateDto dto,
        int createdByInstructorId)
    {
        var list = new System.Collections.Generic.List<(DateTime, DateTime, int, int)>();
        foreach (var i in dto.Instances)
            list.Add((i.StartUtc, i.EndUtc, i.RoomsCount, i.RequiredInstructors));

        return CreateActivityWithInstancesAsync(
            dto.ActivityName,
            dto.ActivityTypeId,
            dto.CourseId,
            dto.LeadInstructorId,
            dto.ApplicationDeadlineUtc,
            createdByInstructorId,
            list);
    }
}
