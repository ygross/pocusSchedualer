using System.Security.Claims;
using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class InstructorCoursesEndpoints
{
    public static void MapInstructorCoursesEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/instructors/courses", async (HttpContext ctx, Db db) =>
        {
            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
                return Results.Unauthorized();

            var me = await db.GetMeByEmailAsync(email);
            if (me == null)
                return Results.Unauthorized();

            var courses = await db.GetInstructorCoursesAsync(me.InstructorId);
            return Results.Ok(courses); // [{ courseId, courseName }]
        });
    }
}
