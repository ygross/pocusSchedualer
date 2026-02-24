using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Dtos;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// LeadCalendar (CourseManager/Admin) endpoints. Routes are relative to /api.
/// </summary>
public static class LeadCalendarEndpoints
{
    public static void MapLeadCalendarEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/leadcalendar", async (HttpContext ctx, Db db, string? from, string? to) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Forbid();

            if (!TryParseRangeUtc(from, to, out var fromUtc, out var toUtc, out var err))
                return Results.BadRequest(err);

            var activities = await db.GetLeadCalendarActivitiesAsync(fromUtc, toUtc);
            var instances  = await db.GetLeadCalendarInstancesAsync(fromUtc, toUtc);

            var activityDtos = activities.Select(a => new LeadCalendarActivityDto
            {
                ActivityId = a.ActivityId,
                ActivityName = a.ActivityName,
                Color = Db.ColorFromActivityId(a.ActivityId)
            }).ToList();

            // ActivityId -> ActivityName for instances (כי אצלך ל-instance אין ActivityName)
            var nameByActivityId = activities
                .GroupBy(a => a.ActivityId)
                .ToDictionary(g => g.Key, g => g.First().ActivityName);

            // instances tuple לפי השגיאה שלך:
            // (int InstanceId, int ActivityId, DateTime StartUtc, DateTime EndUtc, string Location, string Notes)
            // אבל DTO שלך לא כולל Location/Notes -> לא ממפים אותם.
            var instanceDtos = instances.Select(i => new LeadCalendarInstanceDto
            {
                InstanceId = i.InstanceId,
                ActivityId = i.ActivityId,
                ActivityName = nameByActivityId.TryGetValue(i.ActivityId, out var n) ? n : $"Activity {i.ActivityId}",
                StartUtc = DateTime.SpecifyKind(i.StartUtc, DateTimeKind.Utc),
                EndUtc   = DateTime.SpecifyKind(i.EndUtc,   DateTimeKind.Utc),
                Color = Db.ColorFromActivityId(i.ActivityId)
            }).ToList();

            // לא משתמשים ב-LeadCalendarResponseDto.FromUtc/ToUtc כי אצלך זה לא קיים
            return Results.Ok(new
            {
                fromUtc,
                toUtc,
                activities = activityDtos,
                instances = instanceDtos
            });
        });
    }

    private static bool TryParseRangeUtc(string? from, string? to, out DateTime fromUtc, out DateTime toUtc, out string err)
    {
        err = "";
        fromUtc = default;
        toUtc = default;

        var now = DateTime.UtcNow;
        var defFrom = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var defTo = defFrom.AddMonths(1);

        if (string.IsNullOrWhiteSpace(from)) fromUtc = defFrom;
        else if (!DateTime.TryParse(from, out fromUtc)) { err = "Invalid from"; return false; }

        if (string.IsNullOrWhiteSpace(to)) toUtc = defTo;
        else if (!DateTime.TryParse(to, out toUtc)) { err = "Invalid to"; return false; }

        fromUtc = DateTime.SpecifyKind(fromUtc, DateTimeKind.Utc);
        toUtc   = DateTime.SpecifyKind(toUtc, DateTimeKind.Utc);

        if (toUtc <= fromUtc) { err = "Range invalid"; return false; }
        if ((toUtc - fromUtc).TotalDays > 370) { err = "Range too large"; return false; }

        return true;
    }
}
