using System;
using System.Collections.Generic;

public sealed class ActivityCreateRequestDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceCreateRequestDto> Instances { get; set; } = new();
}

public sealed class ActivityInstanceCreateRequestDto
{
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}
