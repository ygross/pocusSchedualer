using System.Web;
using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Services;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Pull-model availability request endpoints.
/// Lead sends formal requests → instructors confirm/decline → lead gets notified.
/// Routes are relative to /api.
/// </summary>
public static class AvailabilityRequestEndpoints
{
    public static void MapAvailabilityRequestEndpoints(this IEndpointRouteBuilder api)
    {
        // ── Lead: POST /lead/instances/{instanceId}/request-availability ──────
        // Creates AvailabilityRequest rows (Status='Requested') for the given instructors.
        // Sends email and/or WhatsApp based on system settings.
        api.MapPost("/lead/instances/{instanceId:int}/request-availability", async (
            HttpContext ctx,
            int instanceId,
            RequestAvailabilityBody body,
            Db db,
            EmailService emailSvc,
            GreenApiWhatsAppService waSvc,
            SettingsService settings,
            AuditService audit,
            IConfiguration cfg) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !ctx.User.IsInRole(Roles.CourseManager))
                return Results.Forbid();

            if (body.InstructorIds == null || body.InstructorIds.Length == 0)
                return Results.BadRequest(new { ok = false, error = "instructorIds is required." });

            var inserted = await db.CreateAvailabilityRequestsAsync(instanceId, body.InstructorIds, myId!.Value);

            await audit.WriteAsync(ctx, myId!.Value, "RequestAvailability", "ActivityInstance", instanceId.ToString(),
                new { inserted, instructorIds = body.InstructorIds, note = body.Note });

            var emailsSent = 0;
            var waSent = 0;

            var emailEnabled = await settings.GetBoolAsync("Email.Enabled", true);
            var emailReq     = await settings.GetBoolAsync("Email.SendAvailabilityRequests", true);
            var waEnabled    = await settings.GetBoolAsync("WhatsApp.Enabled", false);
            var waReq        = await settings.GetBoolAsync("WhatsApp.SendAvailabilityRequests", false);

            if ((body.SendEmail && emailEnabled && emailReq) || (waEnabled && waReq))
            {
                var baseUrl  = await ResolveBaseUrl(settings, ctx);
                var link     = $"{baseUrl}/activitieslist.html";
                var contacts = await db.GetRequestedInstructorContactsAsync(instanceId, body.InstructorIds);

                foreach (var (_, toEmail, fullName, phone) in contacts)
                {
                    var noteHtml = !string.IsNullOrWhiteSpace(body.Note)
                        ? $"<p style='margin-top:12px;color:#4b5563'><b>הערה:</b> {HttpUtility.HtmlEncode(body.Note)}</p>"
                        : "";

                    // Email
                    if (body.SendEmail && emailEnabled && emailReq && !string.IsNullOrWhiteSpace(toEmail))
                    {
                        var subject  = $"בקשת זמינות למופע #{instanceId} – SimPocus";
                        var bodyHtml = BuildRequestEmailBody(fullName, instanceId, link, noteHtml);
                        var id = await emailSvc.QueueAsync(toEmail, subject, bodyHtml, "ActivityInstance", instanceId.ToString());
                        var ok = await emailSvc.TrySendQueuedNowAsync(ctx, id, toEmail, subject, bodyHtml,
                            "ActivityInstance", instanceId.ToString(), myId);
                        if (ok) emailsSent++;
                    }

                    // WhatsApp
                    if (waEnabled && waReq && waSvc.IsEnabled)
                    {
                        var waPhone = FormatWhatsAppPhone(phone);
                        if (!string.IsNullOrWhiteSpace(waPhone))
                        {
                            try
                            {
                                var msg = $"שלום {fullName ?? "מדריך"},\nהתקבלה בקשת זמינות למופע #{instanceId}.\nאנא היכנס/י למערכת ואשר/י: {link}";
                                await waSvc.SendTextAsync(waPhone, msg);
                                waSent++;
                            }
                            catch { /* non-fatal */ }
                        }
                    }
                }
            }

            return Results.Ok(new { ok = true, inserted, emailsSent, waSent });
        });

        // ── Instructor: GET /instructor/availability-requests ─────────────────
        api.MapGet("/instructor/availability-requests", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            var rows = await db.GetMyPendingAvailabilityRequestsAsync(myId.Value);
            return Results.Ok(rows);
        });

        // ── Instructor: POST /availability-requests/{availabilityId}/respond ──
        // Instructor accepts (→ Submitted) or declines (→ Rejected).
        // After respond, notifies Lead via email and/or WhatsApp (if enabled).
        api.MapPost("/availability-requests/{availabilityId:int}/respond", async (
            HttpContext ctx,
            int availabilityId,
            RespondAvailabilityBody body,
            Db db,
            EmailService emailSvc,
            GreenApiWhatsAppService waSvc,
            SettingsService settings,
            AuditService audit) =>
        {
            var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (myId == null) return Results.Unauthorized();

            var updated = await db.RespondToAvailabilityRequestAsync(availabilityId, myId.Value, body.Accept, body.Note);
            if (!updated)
                return Results.NotFound(new { ok = false, error = "Request not found, already responded, or not yours." });

            var action = body.Accept ? "AcceptAvailabilityRequest" : "DeclineAvailabilityRequest";
            await audit.WriteAsync(ctx, myId.Value, action, "AvailabilityRequest", availabilityId.ToString(),
                new { note = body.Note });

            // Notify lead
            var emailEnabled   = await settings.GetBoolAsync("Email.Enabled", true);
            var emailLeadNotify= await settings.GetBoolAsync("Email.SendLeadNotifications", true);
            var waEnabled      = await settings.GetBoolAsync("WhatsApp.Enabled", false);
            var waLeadNotify   = await settings.GetBoolAsync("WhatsApp.SendLeadNotifications", false);

            if ((emailEnabled && emailLeadNotify) || (waEnabled && waLeadNotify))
            {
                var info = await db.GetLeadInfoForInstanceAsync(
                    await db.GetInstanceIdForAvailabilityAsync(availabilityId));

                if (info != null)
                {
                    var instructorName = await db.GetInstructorNameAsync(myId.Value);
                    var verbHe = body.Accept ? "אישר/ה זמינות" : "דחה/תה את הבקשה";
                    var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
                    var startIl = TimeZoneInfo.ConvertTimeFromUtc(info.StartUtc, tz);
                    var startFmt = startIl.ToString("dd/MM/yyyy HH:mm");
                    var baseUrl = await ResolveBaseUrl(settings, ctx);

                    // Email to lead
                    if (emailEnabled && emailLeadNotify && !string.IsNullOrWhiteSpace(info.LeadEmail))
                    {
                        var subject  = $"{instructorName} {verbHe} – {info.ActivityName} {startFmt}";
                        var bodyHtml = BuildLeadNotifyEmailBody(instructorName, verbHe, info, startFmt, body.Note, baseUrl);
                        var id = await emailSvc.QueueAsync(info.LeadEmail, subject, bodyHtml,
                            "AvailabilityRequest", availabilityId.ToString());
                        await emailSvc.TrySendQueuedNowAsync(ctx, id, info.LeadEmail, subject, bodyHtml,
                            "AvailabilityRequest", availabilityId.ToString(), myId);
                    }

                    // WhatsApp to lead
                    if (waEnabled && waLeadNotify && waSvc.IsEnabled)
                    {
                        var waPhone = FormatWhatsAppPhone(info.LeadPhone);
                        if (!string.IsNullOrWhiteSpace(waPhone))
                        {
                            try
                            {
                                var msg = $"📋 SimPocus\n{instructorName} {verbHe} למופע: {info.ActivityName} ({startFmt})"
                                        + (body.Note != null ? $"\nהערה: {body.Note}" : "");
                                await waSvc.SendTextAsync(waPhone, msg);
                            }
                            catch { /* non-fatal */ }
                        }
                    }
                }
            }

            return Results.Ok(new { ok = true, accept = body.Accept });
        });

        // ── Lead: GET /lead/instances/{instanceId}/availability-counts ─────────
        // Returns Requested/Submitted/Rejected/Assigned counts for dashboard.
        api.MapGet("/lead/instances/{instanceId:int}/availability-counts", async (
            HttpContext ctx, int instanceId, Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !ctx.User.IsInRole(Roles.CourseManager))
                return Results.Forbid();

            var counts = await db.GetInstanceAvailabilityCountsAsync(instanceId);
            return Results.Ok(counts);
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    static async Task<string> ResolveBaseUrl(SettingsService settings, HttpContext ctx)
    {
        var configured = await settings.GetStringAsync("System.BaseUrl");
        if (!string.IsNullOrWhiteSpace(configured)) return configured.TrimEnd('/');
        return $"{ctx.Request.Scheme}://{ctx.Request.Host}{ctx.Request.PathBase}";
    }

    static string? FormatWhatsAppPhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("972") && digits.Length >= 12) return digits + "@c.us";
        if (digits.StartsWith("0") && digits.Length == 10)   return "972" + digits[1..] + "@c.us";
        return null;
    }

    static string BuildRequestEmailBody(string? fullName, int instanceId, string link, string noteHtml) => $@"
<div dir='rtl' style='font-family:Heebo,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px'>
  <h2 style='color:#1e3a5f;margin-bottom:8px'>בקשת זמינות – SimPocus Scheduler</h2>
  <p>שלום {HttpUtility.HtmlEncode(fullName ?? "מדריך")},</p>
  <p>הוגשה בקשת זמינות עבורך למופע <b>#{instanceId}</b>.</p>
  <p>אנא היכנס/י למערכת ואשר/י או דחה/י את הבקשה:</p>
  {noteHtml}
  <a href='{link}' style='display:inline-block;margin-top:16px;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:10px;text-decoration:none;font-weight:700'>
    כניסה לרשימת הפעילויות
  </a>
  <p style='margin-top:20px;color:#9ca3af;font-size:12px'>SimPocus Scheduler · SimCenter BGU</p>
</div>";

    static string BuildLeadNotifyEmailBody(string? instructorName, string verbHe,
        LeadInstanceInfoDto info, string startFmt, string? note, string baseUrl) => $@"
<div dir='rtl' style='font-family:Heebo,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px'>
  <h2 style='color:#1e3a5f'>עדכון בקשת זמינות – SimPocus</h2>
  <p><b>{HttpUtility.HtmlEncode(instructorName ?? "מדריך")}</b> {HttpUtility.HtmlEncode(verbHe)}:</p>
  <table style='border-collapse:collapse;margin:12px 0'>
    <tr><td style='color:#6b7280;padding:4px 12px 4px 0'>פעילות</td><td><b>{HttpUtility.HtmlEncode(info.ActivityName)}</b></td></tr>
    <tr><td style='color:#6b7280;padding:4px 12px 4px 0'>תאריך</td><td><b>{startFmt}</b></td></tr>
  </table>
  {(note != null ? $"<p><b>הערה מהמדריך:</b> {HttpUtility.HtmlEncode(note)}</p>" : "")}
  <a href='{baseUrl}/leadassignment.html' style='display:inline-block;margin-top:16px;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:10px;text-decoration:none;font-weight:700'>
    מעבר לשיבוץ
  </a>
  <p style='margin-top:20px;color:#9ca3af;font-size:12px'>SimPocus Scheduler · SimCenter BGU</p>
</div>";
}

public sealed record RequestAvailabilityBody(int[] InstructorIds, bool SendEmail = true, string? Note = null);
public sealed record RespondAvailabilityBody(bool Accept, string? Note = null);
