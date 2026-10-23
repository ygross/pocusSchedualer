namespace PocusSchedualer.Dtos;

public sealed class LeadCalendarSendWhatsAppDto
{
    public string? MessageOverride { get; set; }
    public string? Note { get; set; }
}

public sealed class LeadCalendarSendWhatsAppResultDto
{
    public int InstanceId { get; set; }
    public int RecipientsCount { get; set; }
    public int SentCount { get; set; }
    public List<WhatsAppRecipientResult> Results { get; set; } = new();
    public string Status { get; set; } = "ok";
}

public sealed class WhatsAppRecipientResult
{
    public string? FullName { get; set; }
    public string PhoneRaw { get; set; } = "";
    public string? PhoneE164 { get; set; }
    public string? ChatId { get; set; }
    public bool Sent { get; set; }
    public string? Error { get; set; }
}
