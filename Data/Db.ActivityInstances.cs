using System;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// ActivityInstances CRUD.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Creates an activity instance for a given activity.
    /// Validates time range and ensures activity exists.
    /// </summary>
    public async Task<(bool Ok, string? Error, int InstanceId)> CreateActivityInstanceAsync(int activityId, ActivityInstanceEditDto dto)
    {
        if (dto.StartUtc == default) return (false, "StartUtc is required", 0);
        if (dto.EndUtc == default) return (false, "EndUtc is required", 0);
        if (dto.EndUtc <= dto.StartUtc) return (false, "EndUtc must be after StartUtc", 0);

        const string sql = @"
INSERT INTO dbo.ActivityInstances
(ActivityId, StartUtc, EndUtc, RoomsCount, RequiredInstructors)
VALUES
(@ActivityId, @StartUtc, @EndUtc, @RoomsCount, @RequiredInstructors);
SELECT CAST(SCOPE_IDENTITY() as int);";

        await using var c = Open();

        const string sqlCheck = @"SELECT COUNT(1) FROM dbo.Activities WHERE ActivityId=@activityId;";
        var exists = await c.ExecuteScalarAsync<int>(sqlCheck, new { activityId });
        if (exists <= 0) return (false, "Activity not found", 0);

        var newId = await c.QuerySingleAsync<int>(sql, new
        {
            ActivityId = activityId,
            dto.StartUtc,
            dto.EndUtc,
            dto.RoomsCount,
            dto.RequiredInstructors
        });

        return (true, null, newId);
    }

    /// <summary>
    /// Updates an activity instance.
    /// </summary>
    public async Task<(bool Ok, string? Error)> UpdateActivityInstanceAsync(int instanceId, ActivityInstanceEditDto dto)
    {
        if (dto.StartUtc == default) return (false, "StartUtc is required");
        if (dto.EndUtc == default) return (false, "EndUtc is required");
        if (dto.EndUtc <= dto.StartUtc) return (false, "EndUtc must be after StartUtc");

        const string sql = @"
UPDATE dbo.ActivityInstances
SET
  StartUtc = @StartUtc,
  EndUtc = @EndUtc,
  RoomsCount = @RoomsCount,
  RequiredInstructors = @RequiredInstructors
WHERE InstanceId = @InstanceId;";

        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new
        {
            InstanceId = instanceId,
            dto.StartUtc,
            dto.EndUtc,
            dto.RoomsCount,
            dto.RequiredInstructors
        });

        return rows > 0 ? (true, null) : (false, "Instance not found");
    }

    /// <summary>
    /// Hard deletes an instance row only (no cascade cleanup). Use with care.
    /// </summary>
    public async Task DeleteActivityInstanceAsync(int instanceId)
    {
        const string sql = @"DELETE FROM dbo.ActivityInstances WHERE InstanceId=@id";
        await using var c = Open();
        await c.ExecuteAsync(sql, new { id = instanceId });
    }

    /// <summary>
    /// Deletes an instance with cleanup (AvailabilityRequests + Assignments) and writes an audit log row.
    /// </summary>
    public async Task<(bool Ok, string? Error)> DeleteInstanceAsync(
        int instanceId,
        int actorInstructorId,
        string? reason)
    {
        const string sqlExists = @"SELECT COUNT(1) FROM dbo.ActivityInstances WHERE InstanceId=@instanceId;";
        const string sqlDelAvail = @"DELETE FROM dbo.AvailabilityRequests WHERE InstanceId=@instanceId;";
        const string sqlDelAssign = @"DELETE FROM dbo.Assignments WHERE InstanceId=@instanceId;";
        const string sqlDelInst = @"DELETE FROM dbo.ActivityInstances WHERE InstanceId=@instanceId;";

        const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'Delete', 'ActivityInstance', CAST(@instanceId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

        await using var c = Open();
        using var tx = c.BeginTransaction();
        try
        {
            var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { instanceId }, tx);
            if (exists == 0) { tx.Rollback(); return (false, "NotFound"); }

            await c.ExecuteAsync(sqlDelAvail, new { instanceId }, tx);
            await c.ExecuteAsync(sqlDelAssign, new { instanceId }, tx);

            var rows = await c.ExecuteAsync(sqlDelInst, new { instanceId }, tx);
            if (rows <= 0) { tx.Rollback(); return (false, "NotFound"); }

            var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();
            var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r });
            await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, instanceId, details }, tx);

            tx.Commit();
            return (true, null);
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return (false, ex.Message);
        }
    }

    /// <summary>
    /// Deletes an instance with cleanup (AvailabilityRequests + Assignments) without audit record.
    /// </summary>
    public async Task<(bool Ok, string? Error)> DeleteInstanceAsync(int instanceId)
    {
        const string sqlDelAvail = @"DELETE FROM dbo.AvailabilityRequests WHERE InstanceId = @instanceId;";
        const string sqlDelAssign = @"DELETE FROM dbo.Assignments WHERE InstanceId = @instanceId;";
        const string sqlDelInst = @"DELETE FROM dbo.ActivityInstances WHERE InstanceId = @instanceId;";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            await c.ExecuteAsync(sqlDelAvail, new { instanceId }, tx);
            await c.ExecuteAsync(sqlDelAssign, new { instanceId }, tx);

            var rows = await c.ExecuteAsync(sqlDelInst, new { instanceId }, tx);
            if (rows <= 0)
            {
                tx.Rollback();
                return (false, "Instance not found");
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
}
