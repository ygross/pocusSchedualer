using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Dtos;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// LeadCalendar reminder endpoints. Routes are relative to /api.
/// </summary>
public static class LeadCalendarReminderEndpoints
{
    public static void MapLeadCalendarReminderEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/leadcalendar/instances/{instanceId:int}/send-reminder", async (
            HttpContext ctx,
            int instanceId,
            LeadCalendarSendReminderDto dto,
            Db db,
            EmailService emailSvc) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Forbid();

            // nullable tuple:
            // (int ActivityId, string ActivityName, DateTime StartUtc, DateTime EndUtc, string Location, string? Notes)?
            var info = await db.GetInstanceInfoAsync(instanceId);
            if (info == null) return Results.NotFound("Instance not found");

            var (activityId, activityName, startUtc, endUtc, location, notes) = info.Value;

            var recipients = await db.GetAssignedRecipientsForInstanceAsync(instanceId);
            if (recipients.Count == 0)
            {
                return Results.Ok(new LeadCalendarSendReminderResultDto
                {
                    InstanceId = instanceId,
                    RecipientsCount = 0,
                    Status = "no-recipients"
                });
            }

            var startLocal = DateTime.SpecifyKind(startUtc, DateTimeKind.Utc).ToLocalTime();
            var endLocal   = DateTime.SpecifyKind(endUtc,   DateTimeKind.Utc).ToLocalTime();

            var subject = $"תזכורת: {activityName} | {startLocal:dd/MM/yyyy} {startLocal:HH:mm}";

            var bodyText =
$@"שלום,

תזכורת למופע:
פעילות: {activityName}
מיקום: {location}
תאריך: {startLocal:dd/MM/yyyy}
שעה: {startLocal:HH:mm}–{endLocal:HH:mm}

{(string.IsNullOrWhiteSpace(dto?.Note) ? "" : "הערה:\n" + dto.Note + "\n")}
{(string.IsNullOrWhiteSpace(notes) ? "" : "פרטים:\n" + notes + "\n")}

תודה,
מרכז הסימולציה";

            var bodyHtml = bodyText.Replace("\n", "<br/>");

            int sentNow = 0;

            // אצלך relatedId הוא string? -> חייב ToString()
            var relatedEntity = "ActivityInstance";
            var relatedId = instanceId.ToString();

            foreach (var r in recipients)
            {
                var emailId = await emailSvc.QueueAsync(
                    r.Email,
                    subject,
                    bodyHtml,
                    relatedEntity: relatedEntity,
                    relatedId: relatedId
                );

                var sent = await emailSvc.TrySendQueuedNowAsync(
                    ctx,
                    emailId,
                    r.Email,
                    subject,
                    bodyHtml,
                    relatedEntity: relatedEntity,
                    relatedId: relatedId,
                    actorInstructorId: myId,
                    attemptNo: 1
                );

                if (sent) sentNow++;
            }

            return Results.Ok(new LeadCalendarSendReminderResultDto
            {
                InstanceId = instanceId,
                RecipientsCount = recipients.Count,
                Status = $"sent ({sentNow}/{recipients.Count})"
            });
        });
    }
}
