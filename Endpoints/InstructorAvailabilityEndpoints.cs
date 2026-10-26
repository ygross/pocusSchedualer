using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Instructor availability endpoints (alias routes):
///   POST   /api/instructors/instances/{instanceId}/availability
///   DELETE /api/instructors/instances/{instanceId}/availability
/// </summary>
public static class InstructorAvailabilityEndpoints
{
    public static void MapInstructorAvailabilityEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/instructors/instances/{instanceId:int}/availability", async (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            if (!ctx.User.IsInRole(Roles.Instructor) &&
                !ctx.User.IsInRole(Roles.CourseManager) &&
                !ctx.User.IsInRole(Roles.Admin) &&
                !ctx.User.IsInRole(Roles.Actor))
                return Results.Forbid();

            if (await db.IsInstructorAssignedToInstanceAsync(instanceId, myId.Value))
                return Results.Conflict(new { ok = false, error = "Assigned instance is locked." });

            await db.UpsertInstructorAvailabilityAsync(instanceId, myId.Value);
            return Results.Ok(new { ok = true });
        });

        api.MapDelete("/instructors/instances/{instanceId:int}/availability", async (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            if (!ctx.User.IsInRole(Roles.Instructor) &&
                !ctx.User.IsInRole(Roles.CourseManager) &&
                !ctx.User.IsInRole(Roles.Admin) &&
                !ctx.User.IsInRole(Roles.Actor))
                return Results.Forbid();

            if (await db.IsInstructorAssignedToInstanceAsync(instanceId, myId.Value))
                return Results.Conflict(new { ok = false, error = "Assigned instance is locked." });

            await db.DeleteInstructorAvailabilityAsync(instanceId, myId.Value);
            return Results.Ok(new { ok = true });
        });
    }
}
