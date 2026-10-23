using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Admin-only endpoints mapped under /api/admin (Program.cs creates admin = api.MapGroup("/admin")).
/// </summary>
public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder admin)
    {
        // HARD DELETE Activity (Admin only)
        admin.MapDelete("/activities/{activityId:int}", async (HttpContext ctx, int activityId, Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin || myId == null) return Results.Forbid();

            var result = await db.DeleteActivityAsync(
                activityId,
                myId.Value,
                "HardDelete by Admin"
            );

            return result.Ok
                ? Results.Ok(new { ok = true, activityId })
                : result.Error == "NotFound"
                    ? Results.NotFound(new { ok = false, error = "NotFound", activityId })
                    : Results.BadRequest(new { ok = false, error = result.Error ?? "UnknownError", activityId });
        });
    }
}
