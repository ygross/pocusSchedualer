using System.Security.Claims;
using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/health/db", async (Db db) =>
        {
            var ok = await db.IsDbAliveAsync();
            return Results.Ok(new { ok });
        });

        // Diagnostic: returns current session claims (no auth required)
        api.MapGet("/health/whoami", (HttpContext ctx) =>
        {
            var isAuth = ctx.User?.Identity?.IsAuthenticated == true;
            var role   = ctx.User?.FindFirstValue(ClaimTypes.Role);
            var email  = ctx.User?.FindFirstValue(ClaimTypes.Email);
            var name   = ctx.User?.FindFirstValue(ClaimTypes.Name);
            var instId = ctx.User?.FindFirstValue("instructorId")
                      ?? ctx.User?.FindFirstValue("InstructorId");
            var allRoles = ctx.User?.Claims
                .Where(c => c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList();
            return Results.Ok(new { isAuth, role, email, name, instId, allRoles });
        });
    }
}
