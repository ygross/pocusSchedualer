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
