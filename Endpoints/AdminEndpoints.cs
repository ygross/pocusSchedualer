using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

public static class AdminEndpoints
{
    /// <summary>
    /// Maps Admin-only endpoints under /api/admin.
    /// Includes HARD DELETE operations for activities/instances.
    /// </summary>
    public static void MapAdminEndpoints(this IEndpointRouteBuilder apiAdmin)
    {
        // =======================
        // HARD DELETE Activity (Admin only)
        // DELETE /api/admin/activities/{activityId}
        // =======================
        apiAdmin.MapDelete("/activities/{activityId:int}", async (
            HttpContext ctx,
            int activityId,
            Db db) =>
        {
            // 1) Admin guard
            if (!IsAdmin(ctx.User)) return Results.Forbid();

            // 2) Actor (for audit). If missing, still allow (actorId=0) but you can block if you prefer.
            var actorId = GetInstructorId(ctx.User);

            // 3) Hard delete from DB (activity + instances + related tables)
            var (ok, err) = await db.DeleteActivityAsync(activityId, actorId, "HardDelete by Admin");

            if (ok) return Results.Ok(new { ok = true, activityId });

            // Align with common REST responses
            if (string.Equals(err, "NotFound", StringComparison.OrdinalIgnoreCase))
                return Results.NotFound(new { ok = false, error = "NotFound", activityId });

            return Results.BadRequest(new { ok = false, error = err ?? "UnknownError", activityId });
        })
        .WithName("Admin_HardDeleteActivity");

        // =======================
        // OPTIONAL: HARD DELETE Instance (Admin only)
        // DELETE /api/admin/activity-instances/{instanceId}
        // =======================
        apiAdmin.MapDelete("/activity-instances/{instanceId:int}", (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            if (!IsAdmin(ctx.User)) return Results.Forbid();

            var actorId = GetInstructorId(ctx.User);

            // If you have such method in Db:
            // var (ok, err) = await db.DeleteActivityInstanceAsync(instanceId, actorId, "HardDelete instance by Admin");
            //
            // If you don't have it yet, return 501 so you remember to implement it.
            return Results.StatusCode(StatusCodes.Status501NotImplemented);
        })
        .WithName("Admin_HardDeleteInstance");
    }

    /// <summary>Returns true if the current user is Admin based on claims.</summary>
    private static bool IsAdmin(ClaimsPrincipal user)
    {
        var role =
            user.FindFirst("role")?.Value ??
            user.FindFirst(ClaimTypes.Role)?.Value ??
            "";

        return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Gets instructorId from claims; returns 0 if missing/invalid.</summary>
    private static int GetInstructorId(ClaimsPrincipal user)
    {
        var s =
            user.FindFirst("instructorId")?.Value ??
            user.FindFirst("InstructorId")?.Value ??
            "";

        return int.TryParse(s, out var id) ? id : 0;
    }
}
    