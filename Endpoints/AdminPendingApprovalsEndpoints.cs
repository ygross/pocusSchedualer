using System.Security.Claims;
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

        admin.MapPost("/approve", async (HttpContext ctx, Db db, AdminInstructorActionDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (dto.InstructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid InstructorId" });

            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, "Active");
            if (rows == 0) return Results.NotFound(new { ok = false });

            return Results.Ok(new { ok = true });
        });

        admin.MapPost("/decline", async (HttpContext ctx, Db db, AdminInstructorActionDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (dto.InstructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid InstructorId" });

            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, "Declined");
            if (rows == 0) return Results.NotFound(new { ok = false });

            return Results.Ok(new { ok = true });
        });
    }

    private static bool IsAdmin(HttpContext ctx)
    {
        if (ctx.User?.Identity?.IsAuthenticated != true) return false;
        var role = ctx.User.FindFirstValue(ClaimTypes.Role) ?? "";
        return string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class AdminInstructorActionDto
{
    public int InstructorId { get; set; }
}
