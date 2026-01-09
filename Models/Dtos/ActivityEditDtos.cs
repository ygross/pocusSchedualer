using System;
using System.Collections.Generic;

public class ActivityForEditDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }

    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceEditDto> Instances { get; set; } = new();
}

public class ActivityUpdateDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceEditDto> Instances { get; set; } = new();
}

public class ActivityInstanceEditDto
{
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public class ActivityUpdateHeaderDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }
}
