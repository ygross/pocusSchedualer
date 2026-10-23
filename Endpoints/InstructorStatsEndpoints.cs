// Instructor stats endpoints (relative to /api)
// month = full calendar month (1st -> next month start), Israel time
// week = last 7 days
// quarter = rolling 3 calendar months (start of month -2 -> next month start)

using System.Security.Claims;
using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Api.Dtos;

namespace PocusSchedualer.Endpoints;

public static class InstructorStatsEndpoints
{
    public static void MapInstructorStatsEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/instructor/my-assignments", async (HttpContext ctx, Db db) =>
        {
            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email)) return Results.Unauthorized();
            var me = await db.GetMeByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var rows = await db.GetMyAssignmentsAsync(me.InstructorId);

            return Results.Ok(rows.Select(r => new
            {
                r.AssignmentId,
                r.InstanceId,
                r.ActivityName,
                r.Status,
                StartUtc = r.StartUtc.ToString("o"),
                EndUtc   = r.EndUtc.ToString("o"),
                Hours    = r.EndUtc > r.StartUtc
                           ? Math.Round((r.EndUtc - r.StartUtc).TotalHours, 2)
                           : 0.0
            }));
        });

        api.MapGet("/instructors/stats", async (HttpContext ctx, string? period, string? from, string? to, Db db) =>
        {
            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
                return Results.Unauthorized();

            var me = await db.GetMeByEmailAsync(email);
            if (me == null)
                return Results.Unauthorized();

            DateTime fromUtc, toUtc;
            if (!string.IsNullOrEmpty(from) && !string.IsNullOrEmpty(to)
                && DateTime.TryParse(from, out var fromLocal)
                && DateTime.TryParse(to,   out var toLocal))
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
                fromUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(fromLocal, DateTimeKind.Unspecified), tz);
                toUtc   = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(toLocal.AddDays(1), DateTimeKind.Unspecified), tz);
            }
            else
            {
                (fromUtc, toUtc) = ResolveRange(period);
            }

            InstructorStatsDto dto = await db.GetInstructorStatsAsync(me.InstructorId, fromUtc, toUtc);
            return Results.Ok(dto);
        });
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolveRange(string? period)
    {
        var p = (period ?? "month").Trim().ToLowerInvariant();

        var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);

        var monthStartLocal = new DateTime(nowLocal.Year, nowLocal.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var nextMonthStartLocal = monthStartLocal.AddMonths(1);

        var monthFromUtc = TimeZoneInfo.ConvertTimeToUtc(monthStartLocal, tz);
        var monthToUtc   = TimeZoneInfo.ConvertTimeToUtc(nextMonthStartLocal, tz);

        var lastMonthStartLocal = monthStartLocal.AddMonths(-1);
        var lastMonthToLocal    = monthStartLocal; // = start of current month
        var lastMonthFromUtc    = TimeZoneInfo.ConvertTimeToUtc(lastMonthStartLocal, tz);
        var lastMonthToUtc      = TimeZoneInfo.ConvertTimeToUtc(lastMonthToLocal, tz);

        return p switch
        {
            "week"      => (DateTime.UtcNow.AddDays(-7), DateTime.UtcNow),
            "quarter"   => (
                TimeZoneInfo.ConvertTimeToUtc(monthStartLocal.AddMonths(-2), tz),
                monthToUtc
            ),
            "month"     => (monthFromUtc, monthToUtc),
            "lastmonth" => (lastMonthFromUtc, lastMonthToUtc),
            _           => (lastMonthFromUtc, lastMonthToUtc), // default = last month
        };
    }
}
