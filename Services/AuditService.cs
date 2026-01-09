using System.Text.Json;
using Microsoft.Extensions.Logging;

public sealed class AuditService
{
    private readonly Db _db;
    private readonly ILogger<AuditService> _logger;

    public AuditService(Db db, ILogger<AuditService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task WriteAsync(
        HttpContext ctx,
        int? actorInstructorId,
        string action,      // "Create" / "Update" / "SoftDelete" / "SendEmail" / ...
        string entity,      // "Activity" / "Instance" / "Assignment" / ...
        string? entityId,   // "123" / "instance:55" / ...
        object? details = null)
    {
        var corr = EnsureCorrelationId(ctx);
        var ip = ctx.Connection.RemoteIpAddress?.ToString();
        var ua = ctx.Request.Headers.UserAgent.ToString();

        // לוג אפליקטיבי
        _logger.LogInformation(
            "AUDIT {Action} {Entity}({EntityId}) Actor={Actor} Corr={Corr} IP={Ip}",
            action, entity, entityId, actorInstructorId, corr, ip
        );

        // לוג DB
        string? detailsJson = null;
        if (details != null)
            detailsJson = JsonSerializer.Serialize(details);

        await _db.InsertAuditAsync(
            actorInstructorId: actorInstructorId,
            action: action,
            entity: entity,
            entityId: entityId,
            detailsJson: detailsJson,
            correlationId: corr,
            ip: ip,
            userAgent: ua
        );
    }

    public static string EnsureCorrelationId(HttpContext ctx)
    {
        if (ctx.Request.Headers.TryGetValue("X-Correlation-Id", out var v) && !string.IsNullOrWhiteSpace(v))
        {
            ctx.Response.Headers["X-Correlation-Id"] = v.ToString();
            return v.ToString();
        }

        var id = Guid.NewGuid().ToString("N");
        ctx.Response.Headers["X-Correlation-Id"] = id;
        return id;
    }
}
