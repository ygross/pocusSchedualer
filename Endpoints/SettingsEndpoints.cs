using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Services;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// System settings CRUD endpoints. Admin-only. Routes relative to /api/admin.
/// </summary>
public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder admin)
    {
        // GET /api/admin/settings — returns all settings grouped by category
        admin.MapGet("/settings", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            var rows = await db.GetAllSettingsAsync();
            return Results.Ok(rows);
        });

        // POST /api/admin/settings — upsert a batch of {key, value} pairs
        // Body: [{ key: string, value: string? }]
        admin.MapPost("/settings", async (
            HttpContext ctx,
            SettingUpsertItem[] body,
            Db db,
            SettingsService svc,
            AuditService audit) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            if (body == null || body.Length == 0)
                return Results.BadRequest(new { ok = false, error = "Empty body." });

            foreach (var item in body)
            {
                if (string.IsNullOrWhiteSpace(item.Key)) continue;
                await svc.SaveAsync(item.Key, item.Value, myId);
            }

            await audit.WriteAsync(ctx, myId!.Value, "UpdateSettings", "SystemSettings", "batch",
                new { keys = Array.ConvertAll(body, x => x.Key), count = body.Length });

            return Results.Ok(new { ok = true, saved = body.Length });
        });

        // GET /api/admin/settings/{key} — single setting value
        admin.MapGet("/settings/{key}", async (HttpContext ctx, string key, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            var val = await db.GetSettingValueAsync(key);
            return Results.Ok(new { key, value = val });
        });
    }
}

public sealed record SettingUpsertItem(string Key, string? Value);
