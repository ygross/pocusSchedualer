using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Services;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Availability endpoints for instructors (offer/cancel availability for ME).
/// Includes deadline enforcement when Availability.EnforceDeadline = true.
/// Routes are relative to /api.
/// </summary>
public static class AvailabilityEndpoints
{
    public static void MapAvailabilityEndpoints(this IEndpointRouteBuilder api)
    {
        // POST: offer availability (for ME)
        api.MapPost("/activity-instances/{instanceId:int}/availability", async (
            HttpContext ctx,
            int instanceId,
            Db db,
            SettingsService settings) =>
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

            // Deadline check
            if (await settings.GetBoolAsync("Availability.EnforceDeadline", false))
            {
                var deadlineDays = await settings.GetIntAsync("Availability.DefaultDeadlineDays", 3);
                var deadline = await db.GetInstanceDeadlineAsync(instanceId, deadlineDays);
                if (deadline.HasValue && DateTime.UtcNow > deadline.Value)
                    return Results.Conflict(new { ok = false, error = $"הדדליין לשליחת זמינות עבר ({deadline.Value:dd/MM/yyyy HH:mm} UTC)." });
            }

            await db.UpsertInstructorAvailabilityAsync(instanceId, myId.Value);
            return Results.Ok(new { ok = true });
        });

        // DELETE: cancel availability (for ME)
        api.MapDelete("/activity-instances/{instanceId:int}/availability", async (
            HttpContext ctx,
            int instanceId,
            Db db,
            SettingsService settings) =>
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
