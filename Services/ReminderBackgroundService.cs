using PocusSchedualer.Services;

/// <summary>
/// Hosted background service that sends automatic reminders (email + WhatsApp)
/// to lead instructors 7 days, 3 days, and 1 day before each activity instance.
///
/// Runs once on startup (after a 2-minute warm-up delay) and then every hour.
/// Uses dbo.ReminderLog as a de-duplication guard — each (instance, instructor,
/// daysBefore, channel) combination is only ever sent once.
/// </summary>
public sealed class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceProvider                      _sp;
    private readonly ILogger<ReminderBackgroundService>    _log;

    private static readonly int[] Thresholds = { 7, 3, 1 };

    public ReminderBackgroundService(
        IServiceProvider sp,
        ILogger<ReminderBackgroundService> log)
    {
        _sp  = sp;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Give the app time to fully start before first cycle
        try { await Task.Delay(TimeSpan.FromMinutes(2), ct); }
        catch (OperationCanceledException) { return; }

        while (!ct.IsCancellationRequested)
        {
            try   { await RunCycleAsync(ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _log.LogError(ex, "Reminder cycle failed");
            }

            try { await Task.Delay(TimeSpan.FromHours(1), ct); }
            catch (OperationCanceledException) { break; }
        }
    }

    // ── Core cycle ───────────────────────────────────────────────────────────

    private async Task RunCycleAsync(CancellationToken ct)
    {
        using var scope    = _sp.CreateScope();
        var db             = scope.ServiceProvider.GetRequiredService<Db>();
        var emailSvc       = scope.ServiceProvider.GetRequiredService<EmailService>();
        var waSvc          = scope.ServiceProvider.GetRequiredService<GreenApiWhatsAppService>();
        var settings       = scope.ServiceProvider.GetRequiredService<SettingsService>();
        var waGlobalEnable = await settings.GetBoolAsync("WhatsApp.Enabled", false);

        int totalEmail = 0, totalWa = 0;

        foreach (var days in Thresholds)
        {
            ct.ThrowIfCancellationRequested();

            // ── Email ────────────────────────────────────────────────────────
            var emailPending = await db.GetPendingEmailRemindersAsync(days);
            foreach (var inst in emailPending)
            {
                var (subject, bodyHtml) = BuildEmailBody(inst, days);
                var ok = await emailSvc.SendBackgroundAsync(
                    inst.Email, subject, bodyHtml,
                    relatedEntity: "ActivityInstance",
                    relatedId:     inst.InstanceId.ToString());

                await db.LogReminderAsync(
                    inst.InstanceId, inst.InstructorId, days, "Email",
                    ok ? "Sent" : "Failed");

                if (ok) totalEmail++;
                else _log.LogWarning(
                    "Email reminder FAILED  InstanceId={Id} To={Email} Days={D}",
                    inst.InstanceId, inst.Email, days);
            }

            // ── WhatsApp ─────────────────────────────────────────────────────
            if (waGlobalEnable && waSvc.IsEnabled)
            {
                var waPending = await db.GetPendingWhatsAppRemindersAsync(days);
                foreach (var inst in waPending)
                {
                    var chatId = FormatWaPhone(inst.Phone);
                    if (chatId == null)
                    {
                        await db.LogReminderAsync(
                            inst.InstanceId, inst.InstructorId, days, "WhatsApp",
                            "Failed", "Invalid phone format");
                        continue;
                    }

                    var text = BuildWaText(inst, days);
                    string status;
                    try
                    {
                        await waSvc.SendTextAsync(chatId, text, ct);
                        status = "Sent";
                        totalWa++;
                    }
                    catch (Exception ex)
                    {
                        status = "Failed";
                        _log.LogWarning(ex,
                            "WA reminder FAILED  InstanceId={Id} Phone={Phone} Days={D}",
                            inst.InstanceId, inst.Phone, days);
                    }
                    await db.LogReminderAsync(
                        inst.InstanceId, inst.InstructorId, days, "WhatsApp", status);
                }
            }
        }

        if (totalEmail + totalWa > 0)
            _log.LogInformation(
                "Reminder cycle complete. Email={E} WhatsApp={W}", totalEmail, totalWa);
    }

    // ── Message builders ─────────────────────────────────────────────────────

    private static (string subject, string bodyHtml) BuildEmailBody(ReminderDueDto inst, int days)
    {
        var start  = DateTime.SpecifyKind(inst.StartUtc, DateTimeKind.Utc).ToLocalTime();
        var end    = DateTime.SpecifyKind(inst.EndUtc,   DateTimeKind.Utc).ToLocalTime();
        var when   = DaysLabel(days);

        var subject = $"תזכורת: {inst.ActivityName} — {when} | {start:dd/MM/yyyy}";

        var bodyHtml = $@"<div dir='rtl' style='font-family:Arial,sans-serif;font-size:14px;color:#1e293b'>
<p style='font-size:16px'>שלום <strong>{inst.FullName}</strong>,</p>
<p>תזכורת: מופע <strong>{inst.ActivityName}</strong> מתקיים <strong>{when}</strong>.</p>
<table style='border-collapse:collapse;margin:16px 0;font-size:14px'>
  <tr>
    <td style='padding:6px 16px 6px 0;color:#64748b;font-weight:600'>תאריך:</td>
    <td style='padding:6px 0'><strong>{start:dd/MM/yyyy}</strong></td>
  </tr>
  <tr>
    <td style='padding:6px 16px 6px 0;color:#64748b;font-weight:600'>שעה:</td>
    <td style='padding:6px 0'><strong>{start:HH:mm}–{end:HH:mm}</strong></td>
  </tr>
  <tr>
    <td style='padding:6px 16px 6px 0;color:#64748b;font-weight:600'>מיקום:</td>
    <td style='padding:6px 0'>{inst.Location}</td>
  </tr>
</table>
<p style='margin-top:24px;color:#94a3b8;font-size:12px'>
  הודעה אוטומטית ממערכת תיזמון מרכז הסימולציה — אין להשיב למייל זה.
</p>
</div>";

        return (subject, bodyHtml);
    }

    private static string BuildWaText(ReminderDueDto inst, int days)
    {
        var start = DateTime.SpecifyKind(inst.StartUtc, DateTimeKind.Utc).ToLocalTime();
        var end   = DateTime.SpecifyKind(inst.EndUtc,   DateTimeKind.Utc).ToLocalTime();
        var when  = DaysLabel(days);

        return $"שלום {inst.FullName},\n" +
               $"תזכורת: מופע *{inst.ActivityName}* מתקיים {when}.\n" +
               $"📅 תאריך: {start:dd/MM/yyyy}\n" +
               $"⏰ שעה: {start:HH:mm}–{end:HH:mm}\n" +
               $"📍 מיקום: {inst.Location}\n" +
               "— מרכז הסימולציה";
    }

    private static string DaysLabel(int days) => days switch
    {
        1 => "מחר",
        3 => "בעוד 3 ימים",
        7 => "בעוד שבוע",
        _ => $"בעוד {days} ימים"
    };

    private static string? FormatWaPhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        return digits switch
        {
            _ when digits.StartsWith("972") && digits.Length >= 12 => digits + "@c.us",
            _ when digits.StartsWith("0")   && digits.Length == 10 => "972" + digits[1..] + "@c.us",
            _ => null
        };
    }
}
