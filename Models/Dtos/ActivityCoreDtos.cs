public class ActivityCreateDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }
    public List<ActivityInstanceDto> Instances { get; set; } = new();
}

public class ActivityInstanceDto
{
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public class ActivityDto
{
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }

    public string TypeName { get; set; } = "";
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceDto> Instances { get; set; } = new();
}

public class ActivityTypeDto
{
    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";
}

public class CourseDto
{
    public int CourseId { get; set; }
    public string CourseName { get; set; } = "";
    public int ActivityTypeId { get; set; }
}

public class InstructorDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string? Email { get; set; }
}
