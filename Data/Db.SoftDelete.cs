using System;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Soft-delete operations (IsCancelled + audit).
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Soft deletes an activity and all its instances (sets IsCancelled=1 + reason) and writes an audit log row.
    /// </summary>
    public async Task<(bool Ok, string? Error)> SoftDeleteActivityAsync(
        int activityId,
        int actorInstructorId,
        string? reason)
    {
        const string sqlExists = @"SELECT COUNT(1) FROM Activities WHERE ActivityId=@activityId;";
        const string sqlActivity = @"
UPDATE Activities
SET IsCancelled = 1,
    CancelReason = @reason,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @activityId;";

        const string sqlInstances = @"
UPDATE ActivityInstances
SET IsCancelled = 1,
    CancelReason = @reason,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE ActivityId = @activityId;";

        const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'SoftDelete', 'Activity', CAST(@activityId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { activityId }, tx);
            if (exists == 0)
            {
                tx.Rollback();
                return (false, "NotFound");
            }

            var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();

            await c.ExecuteAsync(sqlInstances, new { activityId, reason = r }, tx);
            await c.ExecuteAsync(sqlActivity, new { activityId, reason = r }, tx);

            var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r });
            await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, activityId, details }, tx);

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
    /// Soft deletes a single instance (sets IsCancelled=1 + reason) and writes an audit log row.
    /// </summary>
    public async Task<(bool Ok, string? Error)> SoftDeleteInstanceAsync(
        int instanceId,
        int actorInstructorId,
        string? reason)
    {
        const string sqlExists = @"SELECT COUNT(1) FROM ActivityInstances WHERE InstanceId=@instanceId;";
        const string sqlInst = @"
UPDATE ActivityInstances
SET IsCancelled = 1,
    CancelReason = @reason,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE InstanceId = @instanceId;";

        const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'SoftDelete', 'ActivityInstance', CAST(@instanceId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

        await using var c = Open();
        using var tx = c.BeginTransaction();
        try
        {
            var exists = await c.ExecuteScalarAsync<int>(sqlExists, new { instanceId }, tx);
            if (exists == 0) { tx.Rollback(); return (false, "NotFound"); }

            var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();

            await c.ExecuteAsync(sqlInst, new { instanceId, reason = r }, tx);

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
    /// Deletes an activity and its related rows (AvailabilityRequests, Assignments, Instances) and writes an audit row.
    /// </summary>
    public async Task<(bool Ok, string? Error)> DeleteActivityAsync(
        int activityId,
        int actorInstructorId,
        string? reason)
    {
        const string sqlGetInstances = @"SELECT InstanceId FROM dbo.ActivityInstances WHERE ActivityId=@activityId;";
        const string sqlDelAvail = @"DELETE FROM dbo.AvailabilityRequests WHERE InstanceId IN @ids;";
        const string sqlDelAssign = @"DELETE FROM dbo.Assignments WHERE InstanceId IN @ids;";
        const string sqlDelInst = @"DELETE FROM dbo.ActivityInstances WHERE ActivityId=@activityId;";
        const string sqlDelAct = @"DELETE FROM dbo.Activities WHERE ActivityId=@activityId;";

        const string sqlAudit = @"
INSERT INTO AuditLog (ActorInstructorId, Action, Entity, EntityId, DetailsJson, CreatedAtUtc)
VALUES (@actor, 'Delete', 'Activity', CAST(@activityId AS nvarchar(50)),
        @details, SYSUTCDATETIME());";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            var ids = (await c.QueryAsync<int>(sqlGetInstances, new { activityId }, tx)).ToList();

            if (ids.Count > 0)
            {
                await c.ExecuteAsync(sqlDelAvail, new { ids }, tx);
                await c.ExecuteAsync(sqlDelAssign, new { ids }, tx);
            }

            await c.ExecuteAsync(sqlDelInst, new { activityId }, tx);

            var rows = await c.ExecuteAsync(sqlDelAct, new { activityId }, tx);
            if (rows <= 0)
            {
                tx.Rollback();
                return (false, "NotFound");
            }

            var r = string.IsNullOrWhiteSpace(reason) ? "Deleted by admin" : reason.Trim();
            var details = System.Text.Json.JsonSerializer.Serialize(new { reason = r, deletedInstances = ids.Count });
            await c.ExecuteAsync(sqlAudit, new { actor = actorInstructorId, activityId, details }, tx);

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
