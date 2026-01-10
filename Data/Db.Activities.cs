using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Activities CRUD and email header/instances projections.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Updates activity header fields (name/type/course/lead/deadline).
    /// </summary>
    public async Task UpdateActivityHeaderAsync(int activityId, ActivityUpdateHeaderDto dto)
    {
        const string sql = @"
UPDATE dbo.Activities SET
  ActivityName=@ActivityName,
  ActivityTypeId=@ActivityTypeId,
  CourseId=@CourseId,
  LeadInstructorId=@LeadInstructorId,
  ApplicationDeadlineUtc=@ApplicationDeadlineUtc,
  UpdatedAtUtc=SYSUTCDATETIME()
WHERE ActivityId=@ActivityId";

        await using var c = Open();
        await c.ExecuteAsync(sql, new
        {
            ActivityId = activityId,
            dto.ActivityName,
            dto.ActivityTypeId,
            dto.CourseId,
            dto.LeadInstructorId,
            dto.ApplicationDeadlineUtc
        });
    }

    /// <summary>
    /// Loads an activity and its instances for editing screen.
    /// </summary>
    public async Task<ActivityForEditDto?> GetActivityForEditAsync(int activityId)
    {
        const string sqlActivity = @"
SELECT TOP 1
  ActivityId,
  ActivityName,
  ActivityTypeId,
  ISNULL(CourseId, 0) AS CourseId,
  ISNULL(LeadInstructorId, 0) AS LeadInstructorId,
  ApplicationDeadlineUtc
FROM dbo.Activities
WHERE ActivityId = @activityId;";

        const string sqlInstances = @"
SELECT
  InstanceId,
  StartUtc,
  EndUtc,
  ISNULL(RoomsCount, 0) AS RoomsCount,
  ISNULL(RequiredInstructors, 0) AS RequiredInstructors
FROM dbo.ActivityInstances
WHERE ActivityId = @activityId
ORDER BY StartUtc;";

        await using var c = Open();

        var activity = await c.QueryFirstOrDefaultAsync<ActivityForEditDto>(sqlActivity, new { activityId });
        if (activity == null) return null;

        var inst = (await c.QueryAsync<ActivityInstanceEditDto>(sqlInstances, new { activityId })).AsList();
        activity.Instances = inst;
        return activity;
    }

    /// <summary>
    /// Updates an activity and replaces all its instances within a transaction.
    /// </summary>
    public async Task<(bool Ok, string? Error)> UpdateActivityAsync(int activityId, ActivityUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ActivityName)) return (false, "ActivityName is required");
        if (dto.ActivityTypeId <= 0) return (false, "ActivityTypeId is required");
        if (dto.CourseId <= 0) return (false, "CourseId is required");
        if (dto.LeadInstructorId <= 0) return (false, "LeadInstructorId is required");
        if (dto.Instances == null || dto.Instances.Count == 0) return (false, "At least one instance is required");

        const string sqlUpdate = @"
UPDATE dbo.Activities
SET
  ActivityName = @ActivityName,
  ActivityTypeId = @ActivityTypeId,
  CourseId = @CourseId,
  LeadInstructorId = @LeadInstructorId,
  ApplicationDeadlineUtc = @ApplicationDeadlineUtc,
  UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @ActivityId;";

        const string sqlDeleteInstances = @"
DELETE FROM dbo.ActivityInstances
WHERE ActivityId = @ActivityId;";

        const string sqlInsertInstance = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors);";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            var rows = await c.ExecuteAsync(sqlUpdate, new
            {
                ActivityId = activityId,
                dto.ActivityName,
                dto.ActivityTypeId,
                dto.CourseId,
                dto.LeadInstructorId,
                dto.ApplicationDeadlineUtc
            }, tx);

            if (rows <= 0)
            {
                tx.Rollback();
                return (false, "Activity not found");
            }

            await c.ExecuteAsync(sqlDeleteInstances, new { ActivityId = activityId }, tx);

            foreach (var inst in dto.Instances)
            {
                await c.ExecuteAsync(sqlInsertInstance, new
                {
                    ActivityId = activityId,
                    inst.StartUtc,
                    inst.EndUtc,
                    inst.RoomsCount,
                    inst.RequiredInstructors
                }, tx);
            }

            tx.Commit();
            return (true, null);
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return (false, "DB error: " + ex.Message);
        }
    }

    /// <summary>
    /// Creates a new activity and inserts its instances in a transaction.
    /// </summary>
    /// <returns>The created ActivityId.</returns>
    public async Task<int> CreateActivityAsync(ActivityCreateDto request)
    {
        const string sqlActivity = @"
INSERT INTO dbo.Activities
(ActivityName, ActivityTypeId, Department, CourseId,
 ApplicationDeadlineUtc, CreatedByInstructorId,
 IsCancelled, CancelReason,
 CreatedAtUtc, UpdatedAtUtc, LeadInstructorId)
OUTPUT INSERTED.ActivityId
VALUES
(@ActivityName, @ActivityTypeId,'',
 @CourseId, @ApplicationDeadlineUtc,
 @LeadInstructorId,0,NULL,
 SYSUTCDATETIME(),SYSUTCDATETIME(),
 @LeadInstructorId);";

        const string sqlInsertInstance = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors);";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            var activityId = await c.QuerySingleAsync<int>(sqlActivity, request, tx);

            foreach (var inst in request.Instances)
            {
                await c.ExecuteAsync(sqlInsertInstance, new
                {
                    ActivityId = activityId,
                    inst.StartUtc,
                    inst.EndUtc,
                    inst.RoomsCount,
                    inst.RequiredInstructors
                }, tx);
            }

            tx.Commit();
            return activityId;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    /// <summary>
    /// Returns the instances of an activity in a projection suitable for email templates.
    /// </summary>
    public async Task<IEnumerable<ActivityEmailInstanceDto>> GetActivityInstancesForEmailAsync(int activityId)
    {
        const string sql = @"
SELECT
  inst.InstanceId,
  inst.StartUtc,
  inst.EndUtc,
  inst.RoomsCount,
  inst.RequiredInstructors
FROM dbo.ActivityInstances inst
WHERE inst.ActivityId = @activityId
ORDER BY inst.StartUtc;";

        await using var cn = Open();
        return await cn.QueryAsync<ActivityEmailInstanceDto>(sql, new { activityId });
    }

    /// <summary>
    /// Returns an activity header projection for outbound emails.
    /// </summary>
    public async Task<ActivityEmailHeaderDto?> GetActivityEmailHeaderAsync(int activityId)
    {
        const string sql = @"
SELECT
  a.ActivityId,
  a.ActivityName,
  t.TypeName,
  c.CourseName,
  a.ApplicationDeadlineUtc,
  a.LeadInstructorId,
  li.FullName AS LeadInstructorName,
  li.Email    AS LeadInstructorEmail
FROM dbo.Activities a
JOIN dbo.ActivityTypes t ON t.ActivityTypeId = a.ActivityTypeId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
LEFT JOIN dbo.Instructors li ON li.InstructorId = a.LeadInstructorId
WHERE a.ActivityId = @activityId;";

        await using var cn = Open();
        return await cn.QueryFirstOrDefaultAsync<ActivityEmailHeaderDto>(sql, new { activityId });
    }
}
