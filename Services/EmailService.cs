using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;

public sealed class EmailService
{
    private readonly Db _db;
    private readonly IConfiguration _cfg;
    private readonly ILogger<EmailService> _logger;

    public EmailService(Db db, IConfiguration cfg, ILogger<EmailService> logger)
    {
        _db = db;
        _cfg = cfg;
        _logger = logger;
    }

    /// <summary>
    /// מכניס מייל לתור (EmailOutbox) ומחזיר EmailId
    /// </summary>
    public async Task<long> QueueAsync(
        string toEmail,
        string subject,
        string bodyHtml,
        string? relatedEntity = null,
        string? relatedId = null)
    {
        return await _db.EnqueueEmailAsync(toEmail, subject, bodyHtml, relatedEntity, relatedId);
    }

    /// <summary>
    /// מנסה לשלוח עכשיו SMTP + לעדכן Outbox + לרשום EmailSendLog
    /// </summary>
    public async Task<bool> TrySendQueuedNowAsync(
        HttpContext ctx,
        long emailId,
        string toEmail,
        string subject,
        string bodyHtml,
        string? relatedEntity,
        string? relatedId,
        int? actorInstructorId,
        int attemptNo = 1)
    {
        var corr = AuditService.EnsureCorrelationId(ctx);
        var ip = ctx.Connection.RemoteIpAddress?.ToString();
        var ua = ctx.Request.Headers.UserAgent.ToString();

        try
        {
            await SendSmtpAsync(toEmail, subject, bodyHtml);

            await _db.MarkEmailOutboxSentAsync(emailId);

            await _db.InsertEmailSendLogAsync(
                emailId: emailId,
                toEmail: toEmail,
                subject: subject,
                relatedEntity: relatedEntity,
                relatedId: relatedId,
                attemptNo: attemptNo,
                provider: "SMTP",
                status: "Sent",
                failReason: null,
                actorInstructorId: actorInstructorId,
                correlationId: corr,
                ip: ip,
                userAgent: ua
            );

            return true;
        }
        catch (Exception ex)
        {
            var msg = ex.Message.Length > 380 ? ex.Message.Substring(0, 380) : ex.Message;

            await _db.MarkEmailOutboxFailedAsync(emailId, msg);

            await _db.InsertEmailSendLogAsync(
                emailId: emailId,
                toEmail: toEmail,
                subject: subject,
                relatedEntity: relatedEntity,
                relatedId: relatedId,
                attemptNo: attemptNo,
                provider: "SMTP",
                status: "Failed",
                failReason: msg,
                actorInstructorId: actorInstructorId,
                correlationId: corr,
                ip: ip,
                userAgent: ua
            );

            _logger.LogError(ex, "SMTP failed. EmailId={EmailId} To={ToEmail}", emailId, toEmail);
            return false;
        }
    }

    private async Task SendSmtpAsync(string toEmail, string subject, string bodyHtml)
    {
        var host = _cfg["Smtp:Host"];
        var user = _cfg["Smtp:User"];
        var pass = _cfg["Smtp:Pass"];
        var from = _cfg["Smtp:From"] ?? user;

        if (string.IsNullOrWhiteSpace(host))
            throw new InvalidOperationException("Missing config: Smtp:Host");
        if (string.IsNullOrWhiteSpace(from))
            throw new InvalidOperationException("Missing config: Smtp:From (or Smtp:User)");

        using var client = new SmtpClient(host)
        {
            EnableSsl = _cfg.GetValue("Smtp:EnableSsl", true),
            Port = _cfg.GetValue("Smtp:Port", 587),
        };

        if (!string.IsNullOrWhiteSpace(user))
            client.Credentials = new NetworkCredential(user, pass);

        using var msg = new MailMessage(from, toEmail, subject, bodyHtml)
        {
            IsBodyHtml = true
        };

        await client.SendMailAsync(msg);
    }
}
