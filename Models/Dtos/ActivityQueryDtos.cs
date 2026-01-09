public class ActivityCalendarItemDto
{
    public int ActivityInstanceId { get; set; }
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";

    public int CourseId { get; set; }
    public string CourseName { get; set; } = "";

    public int LeadInstructorId { get; set; }
    public string LeadInstructorName { get; set; } = "";

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }

    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
    public int AssignedInstructors { get; set; }
    public string? MyStatus { get; set; }
}

public sealed class GanttItemDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";

    public int? CourseId { get; set; }
    public string? CourseName { get; set; }

    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }

    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public class ActivitySearchResultDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";

    public int? CourseId { get; set; }
    public string? CourseName { get; set; }

    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }

    public DateTime? NextStartUtc { get; set; }
}
