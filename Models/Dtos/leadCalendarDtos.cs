public sealed class LeadCalendarInstanceInfo
{
    public int InstanceId { get; set; }
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public string? Department { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
}

public sealed class LeadCalendarRecipient
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
}

public sealed class LeadCalendarActivityDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public string Color { get; set; } = "";
}

public sealed class LeadCalendarInstanceDto
{
    public int InstanceId { get; set; }
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string Color { get; set; } = "";
}

public sealed class LeadCalendarResponseDto
{
    public List<LeadCalendarActivityDto> Activities { get; set; } = new();
    public List<LeadCalendarInstanceDto> Instances { get; set; } = new();
}
