using System.Security.Claims;
using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class InstructorCertEndpoints
{
    public static void MapInstructorCertEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/instructors/certifications", async (HttpContext ctx, Db db) =>
        {
            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email)) return Results.Unauthorized();

            var me = await db.GetMeByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var certs = await db.GetInstructorCertificationsAsync(me.InstructorId);
            return Results.Ok(certs);
        });

        api.MapGet("/admin/instructors/{instructorId:int}/certifications", async (HttpContext ctx, int instructorId, Db db) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            var certs = await db.GetInstructorCertificationsAsync(instructorId);
            return Results.Ok(certs);
        });

        api.MapPut("/admin/instructors/{instructorId:int}/certifications", async (HttpContext ctx, int instructorId, UpdateInstructorCertificationsDto dto, Db db) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (instructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid instructorId" });

            var ids = (dto.ActivityTypeIds ?? new List<int>())
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            await db.SetInstructorCertificationsAsync(instructorId, ids);
            return Results.Ok(new { ok = true, count = ids.Count });
        });
    }

    private static bool IsAdmin(HttpContext ctx)
    {
        if (ctx.User?.Identity?.IsAuthenticated != true) return false;
        var role = ctx.User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        return string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class UpdateInstructorCertificationsDto
{
    public List<int> ActivityTypeIds { get; set; } = new();
}
