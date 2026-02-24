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
    }
}
