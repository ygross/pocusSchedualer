namespace PocusSchedualer.Dtos;

public sealed class LeadCalendarSendReminderDto
{
    public string? Note { get; set; }
}

public sealed class LeadCalendarSendReminderResultDto
{
    public int InstanceId { get; set; }
    public int RecipientsCount { get; set; }
    public string Status { get; set; } = "ok";
}

/// <summary>
/// Custom message sent from the CourseManager Reminders page.
/// </summary>
public sealed class LeadSendCustomMessageDto
{
    public string?  Message  { get; set; }
    public string?  Subject  { get; set; }
    /// <summary>"email" or "whatsapp"</summary>
    public string?  Channel  { get; set; }
}
