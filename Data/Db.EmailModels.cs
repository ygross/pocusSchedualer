/// <summary>
/// Email payload used by API endpoints / services before enqueueing into EmailOutbox.
/// </summary>
public sealed record EmailPayload(
    string ToEmail,
    string Subject,
    string BodyHtml,
    string? RelatedEntity,
    string? RelatedId
);
