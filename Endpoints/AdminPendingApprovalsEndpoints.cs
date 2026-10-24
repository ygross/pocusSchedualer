using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class AdminPendingApprovalsEndpoints
{
    public static void MapAdminPendingApprovalsEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapGet("/pending-approvals", async (HttpContext ctx, Db db) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            var items = await db.GetPendingInstructorsAsync();
            return Results.Ok(items);
        });

        admin.MapPost("/pending-approvals/approve", async (HttpContext ctx, Db db, AdminInstructorActionDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (dto.InstructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid InstructorId" });

            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, "Active");
            if (rows == 0) return Results.NotFound(new { ok = false, message = "Instructor not found" });

            return Results.Ok(new { ok = true, status = "Active" });
        });

        admin.MapPost("/pending-approvals/decline", async (HttpContext ctx, Db db, AdminInstructorActionDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (dto.InstructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid InstructorId" });

            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, "Declined");
            if (rows == 0) return Results.NotFound(new { ok = false, message = "Instructor not found" });

            return Results.Ok(new { ok = true, status = "Declined" });
        });
    }

    private static bool IsAdmin(HttpContext ctx)
    {
        var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
        return isAuth && isAdmin;
    }
}

public sealed class AdminInstructorActionDto
{
    public int InstructorId { get; set; }
}
