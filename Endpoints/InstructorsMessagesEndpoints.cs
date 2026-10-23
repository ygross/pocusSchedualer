using System.Security.Claims;

namespace PocusSchedualer.Endpoints;

public static class InstructorsMessagesEndpoints
{
    public static void MapInstructorsMessagesEndpoints(this IEndpointRouteBuilder api)
    {
        // GET /instructors/messages?fromYear=2026&fromMonth=1&monthsBack=6
        api.MapGet("/instructors/messages", async (
            HttpContext ctx,
            Db db,
            int? fromYear,
            int? fromMonth,
            int? monthsBack
        ) =>
        {
            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
                return Results.Unauthorized();

            var me = await db.GetMeByEmailAsync(email);
            if (me == null)
                return Results.Unauthorized();

            var now = DateTime.UtcNow;
            int y = fromYear ?? now.Year;
            int m = fromMonth ?? now.Month;
            int back = monthsBack ?? 6;

            if (m < 1 || m > 12) return Results.BadRequest("fromMonth must be 1..12");
            if (y < 2000 || y > 2100) return Results.BadRequest("fromYear out of range");

            var rows = await db.GetInstructorMessagesAsync(me.Email, y, m, back);

            return Results.Ok(new
            {
                instructorEmail = me.Email,
                fromYear = y,
                fromMonth = m,
                monthsBack = Math.Clamp(back, 1, 24),
                rows
            });
        });
    }
}
