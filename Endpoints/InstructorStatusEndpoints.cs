using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class InstructorStatusEndpoints
{
    public static void MapInstructorStatusEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/admin/instructors/status", async (HttpContext ctx, Db db, ChangeInstructorStatusDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (dto.InstructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid InstructorId" });

            var status = NormalizeStatus(dto.Status);
            if (status == null)
                return Results.BadRequest(new { ok = false, message = "Invalid status" });

            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, status);
            if (rows == 0) return Results.NotFound(new { ok = false, message = "Instructor not found" });

            return Results.Ok(new { ok = true, status });
        });
    }

    private static bool IsAdmin(HttpContext ctx)
    {
        var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
        return isAuth && isAdmin;
    }

    private static string? NormalizeStatus(string? status)
    {
        var raw = (status ?? string.Empty).Trim().ToLowerInvariant();
        return raw switch
        {
            "active" => "Active",
            "inactive" => "Inactive",
            "declined" => "Declined",
            "pendingapproval" => "PendingApproval",
            _ => null
        };
    }
}

public sealed class ChangeInstructorStatusDto
{
    public int InstructorId { get; set; }
    public string Status { get; set; } = string.Empty;
}
