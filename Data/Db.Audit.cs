using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Audit logging utilities.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Inserts an audit log row (extended columns) to dbo.AuditLog.
    /// </summary>
    /// <param name="actorInstructorId">Who performed the action (optional).</param>
    /// <param name="action">Action name (e.g., Create/Update/Delete).</param>
    /// <param name="entity">Entity type name (optional).</param>
    /// <param name="entityId">Entity identifier (optional).</param>
    /// <param name="detailsJson">JSON payload with details (optional).</param>
    /// <param name="correlationId">Request correlation id (optional).</param>
    /// <param name="ip">Requester IP (optional).</param>
    /// <param name="userAgent">Requester user-agent (optional).</param>
    public async Task InsertAuditAsync(
        int? actorInstructorId,
        string action,
        string? entity,
        string? entityId,
        string? detailsJson,
        string? correlationId,
        string? ip,
        string? userAgent)
    {
        const string sql = @"
INSERT INTO dbo.AuditLog
(ActorInstructorId, Action, Entity, EntityId, DetailsJson, CorrelationId, Ip, UserAgent, CreatedAtUtc)
VALUES
(@ActorInstructorId, @Action, @Entity, @EntityId, @DetailsJson, @CorrelationId, @Ip, @UserAgent, SYSUTCDATETIME());";

        await using var c = Open();
        await c.ExecuteAsync(sql, new
        {
            ActorInstructorId = actorInstructorId,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            DetailsJson = detailsJson,
            CorrelationId = correlationId,
            Ip = ip,
            UserAgent = userAgent
        });
    }
}
