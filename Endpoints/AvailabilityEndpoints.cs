using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using PocusSchedualer.Services;

/// <summary>
/// Availability endpoints for instructors:
/// - Offer availability for an instance
/// - Cancel availability for an instance
/// Hard-locked if instructor is assigned to the instance.
/// </summary>
public static class AvailabilityEndpoints
{
    /// <summary>
    /// Maps availability endpoints under /api/api.
    /// Authorization:
    /// - Requires authenticated user with one of: Instructor, CourseManager, Admin.
    /// - Requires instructorId claim (MyInstructorId) to operate "as me".
    /// </summary>
    public static void MapAvailabilityEndpoints(this WebApplication app)
    {
        // POST: offer availability (for ME)
        app.MapPost("/api/api/activity-instances/{instanceId:int}/availability", async (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            // role check (multi-role) - strict as requested
            // NOTE: we allow Admin / CourseManager / Instructor to submit availability.
            // If you want ONLY Instructor, remove CourseManager/Admin here.
            if (!ctx.User.IsInRole(Roles.Instructor) &&
                !ctx.User.IsInRole(Roles.CourseManager) &&
                !ctx.User.IsInRole(Roles.Admin))
                return Results.Forbid();

            // hard lock if assigned
            if (await db.IsInstructorAssignedToInstanceAsync(instanceId, myId.Value))
                return Results.Conflict(new { ok = false, error = "Assigned instance is locked." });

            await db.UpsertInstructorAvailabilityAsync(instanceId, myId.Value);
            return Results.Ok(new { ok = true });
        })
        .RequireAuthorization(p => p.RequireRole(Roles.Instructor, Roles.CourseManager, Roles.Admin));

        // DELETE: cancel availability (for ME)
        app.MapDelete("/api/api/activity-instances/{instanceId:int}/availability", async (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            if (!ctx.User.IsInRole(Roles.Instructor) &&
                !ctx.User.IsInRole(Roles.CourseManager) &&
                !ctx.User.IsInRole(Roles.Admin))
                return Results.Forbid();

            // hard lock if assigned
            if (await db.IsInstructorAssignedToInstanceAsync(instanceId, myId.Value))
                return Results.Conflict(new { ok = false, error = "Assigned instance is locked." });

            await db.DeleteInstructorAvailabilityAsync(instanceId, myId.Value);
            return Results.Ok(new { ok = true });
        })
        .RequireAuthorization(p => p.RequireRole(Roles.Instructor, Roles.CourseManager, Roles.Admin));
    }
}
