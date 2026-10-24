using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class BugReportEndpoints
{
    public static void MapBugReportEndpoints(this IEndpointRouteBuilder api)
    {
        // Public — no auth required so any user (even unauthenticated) can submit a report
        api.MapPost("/bugreport", async (HttpContext ctx, BugReportDto dto, EmailService emailSvc, IConfiguration cfg) =>
        {
            var msg = (dto.Message ?? "").Trim();
            if (string.IsNullOrWhiteSpace(msg))
                return Results.BadRequest(new { ok = false, error = "Message is required" });

            var adminEmail = cfg["Smtp:AdminEmail"] ?? cfg["AdminEmail"] ?? "ygross@bgu.ac.il";
            var pageUrl  = (dto.PageUrl   ?? "לא ידוע").Trim();
            var reporter = (dto.UserEmail ?? "אנונימי").Trim();
            var browser  = ctx.Request.Headers.UserAgent.ToString();
            var ip       = ctx.Connection.RemoteIpAddress?.ToString() ?? "?";

            // Embed screenshot as inline image if provided (base64 data-URI)
            var screenshotHtml = "";
            if (!string.IsNullOrWhiteSpace(dto.Screenshot))
            {
                var dataUri = dto.Screenshot.StartsWith("data:")
                    ? dto.Screenshot
                    : $"data:image/png;base64,{dto.Screenshot}";
                screenshotHtml = $@"<hr/><p><strong>צילום מסך:</strong></p>
<img src=""{dataUri}"" style=""max-width:100%;border:1px solid #ccc;border-radius:6px"" />";
            }

            var subject  = $"[PocusSchedualer] דיווח תקלה — {DateTime.Now:dd/MM/yyyy HH:mm}";
            var bodyHtml = $@"<div dir='rtl' style='font-family:Arial,sans-serif;font-size:14px'>
<h2 style='color:#e74c3c'>🐛 דיווח תקלה חדש</h2>
<table style='border-collapse:collapse;width:100%'>
  <tr><td style='padding:6px;font-weight:bold;width:130px'>מדווח:</td><td style='padding:6px'>{System.Web.HttpUtility.HtmlEncode(reporter)}</td></tr>
  <tr><td style='padding:6px;font-weight:bold'>עמוד:</td><td style='padding:6px'>{System.Web.HttpUtility.HtmlEncode(pageUrl)}</td></tr>
  <tr><td style='padding:6px;font-weight:bold'>זמן:</td><td style='padding:6px'>{DateTime.Now:dd/MM/yyyy HH:mm:ss}</td></tr>
  <tr><td style='padding:6px;font-weight:bold'>IP:</td><td style='padding:6px'>{ip}</td></tr>
  <tr><td style='padding:6px;font-weight:bold'>דפדפן:</td><td style='padding:6px;font-size:11px'>{System.Web.HttpUtility.HtmlEncode(browser)}</td></tr>
</table>
<hr/>
<p><strong>תיאור הבעיה:</strong></p>
<div style='background:#f8f9fa;padding:12px;border-radius:6px;white-space:pre-wrap'>{System.Web.HttpUtility.HtmlEncode(msg)}</div>
{screenshotHtml}
</div>";

            try
            {
                var emailId = await emailSvc.QueueAsync(adminEmail, subject, bodyHtml, "BugReport", null);
                await emailSvc.TrySendQueuedNowAsync(ctx, emailId, adminEmail, subject, bodyHtml, "BugReport", null, null);
                return Results.Ok(new { ok = true });
            }
            catch (Exception ex)
            {
                return Results.Problem($"Failed to send report: {ex.Message}", statusCode: 500);
            }
        });
    }
}

public sealed class BugReportDto
{
    public string  Message    { get; set; } = "";
    public string? Screenshot { get; set; }
    public string? PageUrl    { get; set; }
    public string? UserEmail  { get; set; }
}
