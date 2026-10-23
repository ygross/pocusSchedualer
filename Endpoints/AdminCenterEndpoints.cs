using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class AdminCenterEndpoints
{
    public static void MapAdminCenterEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapGet("/center-stats", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            var (summary, byType) = await db.GetCenterStatsAsync();
            return Results.Ok(new { summary, byType });
        });

        admin.MapGet("/activity-tree", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            var tree = await db.GetActivityTreeAsync();
            return Results.Ok(tree);
        });
    }
}
