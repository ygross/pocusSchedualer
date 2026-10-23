using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Services;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Allows an instructor to cancel their own approved assignment (before the event starts).
/// Respects the Cancellation.AllowInstructorCancel system setting.
/// Routes are relative to /api.
/// </summary>
public static class InstructorCancellationEndpoints
{
    public static void MapInstructorCancellationEndpoints(this IEndpointRouteBuilder api)
    {
        // POST /instructor/assignments/{assignmentId}/cancel
        api.MapPost("/instructor/assignments/{assignmentId:int}/cancel", async (
            HttpContext ctx,
            int assignmentId,
            Db db,
            SettingsService settings,
            AuditService audit) =>
        {
            var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            var allowed = await settings.GetBoolAsync("Cancellation.AllowInstructorCancel", true);
            if (!allowed)
                return Results.Conflict(new { ok = false, error = "ביטול שיבוץ עצמאי אינו מופעל כרגע. פנה למרכז הקורס." });

            var cancelled = await db.CancelInstructorAssignmentAsync(assignmentId, myId.Value);
            if (!cancelled)
                return Results.NotFound(new { ok = false, error = "השיבוץ לא נמצא, כבר בוטל, האירוע כבר החל, או שהשיבוץ אינו שלך." });

            await audit.WriteAsync(ctx, myId.Value, "CancelAssignment", "Assignment", assignmentId.ToString(), null);

            return Results.Ok(new { ok = true });
        });

        // GET /instructor/assignments/instance/{instanceId}/my
        // Returns the instructor's active assignment ID for a given instance (for the cancel button).
        api.MapGet("/instructor/assignments/instance/{instanceId:int}/my", async (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            var assignmentId = await db.GetMyAssignmentIdAsync(instanceId, myId.Value);
            return Results.Ok(new { assignmentId });
        });
    }
}
