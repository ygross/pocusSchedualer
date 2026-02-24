using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Api.Dtos;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// LeadsStatus (CourseManager/Admin) consolidated dashboard endpoints. Routes are relative to /api.
///
/// Intended usage (frontend):
///  GET /api/lead/status?month=YYYY-MM
///  GET /api/lead/status?courseId=123&month=YYYY-MM
///
/// Admin can optionally impersonate a specific lead:
///  GET /api/lead/status?leadInstructorId=7&courseId=123&month=YYYY-MM
/// </summary>
public static class LeadStatusEndpoints
{
    public static void MapLeadStatusEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/lead/status", async (
            HttpContext ctx,
            Db db,
            int? courseId,
            string? month,
            int? leadInstructorId,
            bool? includeMessageBody
        ) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Unauthorized();

            var effectiveLeadId = isAdmin ? leadInstructorId : myId;

            // Course dropdown
            var courses = effectiveLeadId.HasValue
                ? await db.GetCoursesForLeadAsync(effectiveLeadId.Value)
                : new List<LeadCourseDto>();

            // Pick a default course if none provided (first in list)
            int? selectedCourseId = courseId ?? courses.FirstOrDefault()?.CourseId;

            // Resolve month range (Israel time -> UTC)
            var (fromUtc, toUtc, monthKey) = ResolveMonthRangeUtc(month);

            LeadStatusSummaryDto? summary = null;
            var instances = new List<LeadStatusInstanceRowDto>();
            var messages = new List<LeadStatusMessageGroupDto>();
            var fairness = new List<LeadStatusFairnessRowDto>();

            if (selectedCourseId.HasValue)
            {
                // For non-admin we enforce lead guard inside DB queries.
                int? guardLeadId = isAdmin ? null : effectiveLeadId;

                instances = await db.GetLeadCourseInstancesStatusAsync(
                    selectedCourseId.Value, fromUtc, toUtc, guardLeadId);

                summary = BuildSummary(instances);

                messages = await db.GetLeadCourseMessagesGroupedAsync(
                    selectedCourseId.Value, fromUtc, toUtc, guardLeadId, includeMessageBody ?? false);

                fairness = await db.GetLeadCourseFairnessAsync(
                    selectedCourseId.Value, fromUtc, toUtc, guardLeadId);
            }

            var dto = new LeadStatusResponseDto(
                EffectiveLeadInstructorId: effectiveLeadId,
                SelectedCourseId: selectedCourseId,
                Month: monthKey,
                FromUtc: fromUtc,
                ToUtc: toUtc,
                Courses: courses,
                Summary: summary,
                Instances: instances,
                Messages: messages,
                Fairness: fairness
            );

            return Results.Ok(dto);
        });
    }

    private static LeadStatusSummaryDto BuildSummary(List<LeadStatusInstanceRowDto> rows)
    {
        int totalInstances = rows.Count;
        int cancelled = rows.Count(r => r.IsCancelled);

        int fully = 0;
        int partial = 0;
        int none = 0;
        int totalRequired = 0;
        int totalAssigned = 0;

        foreach (var r in rows)
        {
            if (r.IsCancelled) continue;

            totalRequired += Math.Max(0, r.RequiredInstructors);
            totalAssigned += Math.Max(0, r.AssignedCount);

            if (r.AssignedCount <= 0) none++;
            else if (r.AssignedCount >= r.RequiredInstructors) fully++;
            else partial++;
        }

        return new LeadStatusSummaryDto(
            TotalInstances: totalInstances,
            CancelledInstances: cancelled,
            FullyStaffed: fully,
            PartiallyStaffed: partial,
            Unstaffed: none,
            TotalRequired: totalRequired,
            TotalAssigned: totalAssigned
        );
    }

    /// <summary>
    /// month: "YYYY-MM". If null/invalid -> current month.
    /// Uses Israel time zone and converts boundaries to UTC.
    /// </summary>
    private static (DateTime FromUtc, DateTime ToUtc, string MonthKey) ResolveMonthRangeUtc(string? month)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);

        int y = nowLocal.Year;
        int m = nowLocal.Month;

        var key = (month ?? "").Trim();
        if (key.Length >= 7)
        {
            // YYYY-MM
            if (int.TryParse(key[..4], out var yy) && int.TryParse(key.Substring(5, 2), out var mm))
            {
                if (yy is >= 2000 and <= 2100 && mm is >= 1 and <= 12)
                {
                    y = yy;
                    m = mm;
                }
            }
        }

        var startLocal = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var nextLocal = startLocal.AddMonths(1);

        var fromUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
        var toUtc = TimeZoneInfo.ConvertTimeToUtc(nextLocal, tz);

        var monthKey = $"{y:0000}-{m:00}";
        return (fromUtc, toUtc, monthKey);
    }
}
