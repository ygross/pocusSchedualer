using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Dtos;
using PocusSchedualer.Services;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// LeadCalendar reminder endpoints. Routes are relative to /api.
/// </summary>
public static class LeadCalendarReminderEndpoints
{
    // ── Helper: format phone → WhatsApp chatId ──────────────────────────────
    private static string? FormatWaPhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("972") && digits.Length >= 12) return digits + "@c.us";
        if (digits.StartsWith("0")   && digits.Length == 10) return "972" + digits[1..] + "@c.us";
        return null;
    }

    public static void MapLeadCalendarReminderEndpoints(this IEndpointRouteBuilder api)
    {
        // ── GET instances for a specific activity (for reminders dropdown) ──
        api.MapGet("/leadcalendar/activities/{activityId:int}/instances", async (
            HttpContext ctx,
            int activityId,
            Db db) =>
        {
            var (isAuth, isAdmin, isCM, myId) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            // CourseManagers may only view instances of activities they lead
            if (!isAdmin && isCM && myId.HasValue)
            {
                var isLead = await db.IsLeadForActivityAsync(activityId, myId.Value);
                if (!isLead) return Results.Forbid();
            }

            try
            {
                var instances = await db.GetInstancesForActivityAsync(activityId);
                return Results.Ok(instances.Select(i => new
                {
                    instanceId    = i.InstanceId,
                    startUtc      = i.StartUtc,
                    endUtc        = i.EndUtc,
                    location      = i.Location,
                    assignedCount = i.AssignedCount
                }));
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message, statusCode: 500);
            }
        });

        // ── POST custom message to all assigned instructors of an instance ──
        api.MapPost("/leadcalendar/instances/{instanceId:int}/send-custom-message", async (
            HttpContext ctx,
            int instanceId,
            LeadSendCustomMessageDto dto,
            Db db,
            EmailService emailSvc,
            GreenApiWhatsAppService waSvc,
            SettingsService settings) =>
        {
            var (isAuth, isAdmin, isCM, myId) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            if (string.IsNullOrWhiteSpace(dto?.Message))
                return Results.BadRequest(new { ok = false, error = "Message is required" });

            var channel = (dto.Channel ?? "email").Trim().ToLowerInvariant();
            if (channel != "email" && channel != "whatsapp")
                return Results.BadRequest(new { ok = false, error = "Channel must be 'email' or 'whatsapp'" });

            // CourseManagers may only send messages for activities they lead
            if (!isAdmin && isCM && myId.HasValue)
            {
                var actId = await db.GetActivityIdForInstanceAsync(instanceId);
                if (!actId.HasValue) return Results.NotFound(new { ok = false, error = "Instance not found" });
                var isLead = await db.IsLeadForActivityAsync(actId.Value, myId.Value);
                if (!isLead) return Results.Forbid();
            }

            var info = await db.GetInstanceInfoAsync(instanceId);
            if (info == null) return Results.NotFound(new { ok = false, error = "Instance not found" });
            var (activityId, activityName, startUtc, endUtc, location, _) = info.Value;

            var contacts = await db.GetAssignedInstructorContactsAsync(instanceId);
            if (contacts.Count == 0)
                return Results.Ok(new { ok = true, sent = 0, failed = 0, status = "no-recipients" });

            var startLocal = DateTime.SpecifyKind(startUtc, DateTimeKind.Utc).ToLocalTime();
            var subject    = dto.Subject?.Trim().Length > 0
                ? dto.Subject.Trim()
                : $"הודעה ממרכז קורס: {activityName} | {startLocal:dd/MM/yyyy}";

            int sent = 0, failed = 0;
            var errors = new List<string>();

            if (channel == "email")
            {
                var bodyHtml = $"<div dir='rtl'>{dto.Message.Replace("\n","<br/>")}</div>";
                foreach (var c in contacts)
                {
                    try
                    {
                        var emailId = await emailSvc.QueueAsync(c.Email, subject, bodyHtml,
                            relatedEntity: "ActivityInstance", relatedId: instanceId.ToString());
                        var ok = await emailSvc.TrySendQueuedNowAsync(
                            ctx, emailId, c.Email, subject, bodyHtml,
                            relatedEntity: "ActivityInstance", relatedId: instanceId.ToString(),
                            actorInstructorId: myId, attemptNo: 1);
                        if (ok) sent++; else { failed++; errors.Add($"{c.Email}: send failed"); }
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        errors.Add($"{c.Email}: {ex.Message[..Math.Min(80, ex.Message.Length)]}");
                    }
                }
            }
            else // whatsapp
            {
                var waEnabled = await settings.GetBoolAsync("WhatsApp.Enabled", false);
                if (!waEnabled || !waSvc.IsEnabled)
                    return Results.Ok(new { ok = false, sent = 0, failed = 0, status = "whatsapp-not-configured" });

                foreach (var c in contacts)
                {
                    var waPhone = FormatWaPhone(c.Phone);
                    if (waPhone == null) { failed++; errors.Add($"{c.Email}: no phone"); continue; }
                    try
                    {
                        await waSvc.SendTextAsync(waPhone, dto.Message);
                        sent++;
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        errors.Add($"{c.Email}: {ex.Message[..Math.Min(80, ex.Message.Length)]}");
                    }
                }
            }

            return Results.Ok(new { ok = true, sent, failed, total = contacts.Count,
                status = $"sent {sent}/{contacts.Count}", errors });
        });

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
