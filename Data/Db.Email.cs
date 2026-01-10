using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Email outbox / send-log persistence.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Marks an EmailOutbox row as sent and sets SentAtUtc.
    /// </summary>
    public async Task MarkEmailOutboxSentAsync(long emailId)
    {
        const string sql = @"
UPDATE dbo.EmailOutbox
SET Status='Sent', SentAtUtc=SYSUTCDATETIME(), FailReason=NULL
WHERE EmailId=@EmailId;";

        await using var c = Open();
        await c.ExecuteAsync(sql, new { EmailId = emailId });
    }

    /// <summary>
    /// Marks an EmailOutbox row as failed and saves the failure reason.
    /// </summary>
    public async Task MarkEmailOutboxFailedAsync(long emailId, string failReason)
    {
        const string sql = @"
UPDATE dbo.EmailOutbox
SET Status='Failed', FailReason=@FailReason
WHERE EmailId=@EmailId;";

        await using var c = Open();
        await c.ExecuteAsync(sql, new { EmailId = emailId, FailReason = failReason });
    }

    /// <summary>
    /// Inserts an EmailSendLog row (history of send attempts).
    /// </summary>
    /// <returns>The created log id.</returns>
    public async Task<long> InsertEmailSendLogAsync(
        long? emailId,
        string toEmail,
        string subject,
        string? relatedEntity,
        string? relatedId,
        int attemptNo,
        string provider,
        string status,
        string? failReason,
        int? actorInstructorId,
        string? correlationId,
        string? ip,
        string? userAgent)
    {
        const string sql = @"
INSERT INTO dbo.EmailSendLog
(EmailId, ToEmail, Subject, RelatedEntity, RelatedId, AttemptNo, Provider, Status, FailReason,
 ActorInstructorId, CorrelationId, Ip, UserAgent, CreatedAtUtc)
OUTPUT INSERTED.LogId
VALUES
(@EmailId, @ToEmail, @Subject, @RelatedEntity, @RelatedId, @AttemptNo, @Provider, @Status, @FailReason,
 @ActorInstructorId, @CorrelationId, @Ip, @UserAgent, SYSUTCDATETIME());";

        await using var c = Open();
        return await c.QuerySingleAsync<long>(sql, new
        {
            EmailId = emailId,
            ToEmail = toEmail,
            Subject = subject,
            RelatedEntity = relatedEntity,
            RelatedId = relatedId,
            AttemptNo = attemptNo,
            Provider = provider,
            Status = status,
            FailReason = failReason,
            ActorInstructorId = actorInstructorId,
            CorrelationId = correlationId,
            Ip = ip,
            UserAgent = userAgent
        });
    }

    /// <summary>
    /// Enqueues a new email into dbo.EmailOutbox with status "Queued".
    /// </summary>
    /// <returns>The created EmailId.</returns>
    public async Task<long> EnqueueEmailAsync(string toEmail, string subject, string bodyHtml, string? relatedEntity, string? relatedId)
    {
        const string sql = @"
INSERT INTO dbo.EmailOutbox
(ToEmail, Subject, BodyHtml, RelatedEntity, RelatedId, Status, CreatedAtUtc)
OUTPUT INSERTED.EmailId
VALUES
(@ToEmail, @Subject, @BodyHtml, @RelatedEntity, @RelatedId, 'Queued', SYSUTCDATETIME());";

        await using var c = Open();
        return await c.QuerySingleAsync<long>(sql, new
        {
            ToEmail = toEmail,
            Subject = subject,
            BodyHtml = bodyHtml,
            RelatedEntity = relatedEntity,
            RelatedId = relatedId
        });
    }
}
