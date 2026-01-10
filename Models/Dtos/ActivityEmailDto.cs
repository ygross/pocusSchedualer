public class ActivityEmailDto
{
    public string ToEmail { get; set; } = "";
    public string Subject { get; set; } = "";
    public string BodyHtml { get; set; } = "";
    public string? RelatedEntity { get; set; }
    public string? RelatedId { get; set; }
}