 

 public sealed class ActivityEmailHeaderDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public string TypeName { get; set; } = "";
    public string? CourseName { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }
    public string? LeadInstructorEmail { get; set; }
}

public sealed class ActivityEmailInstanceDto
{
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int? RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public sealed class LeadActivityDetailsDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public int? CourseId { get; set; }
    public int? LeadInstructorId { get; set; }

    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceWithIdDto> Instances { get; set; } = new();
}

public sealed class ActivityInstanceWithIdDto
{
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public sealed class LeadInstanceAvailabilityDto
{
    public int AvailabilityId { get; set; }
    public int InstanceId { get; set; }
    public int InstructorId { get; set; }

    public string FullName { get; set; } = "";
    public string? Email { get; set; }

    public string Status { get; set; } = "";
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime? DecisionAtUtc { get; set; }
    public int? DecisionByInstructorId { get; set; }
    public string? DecisionNote { get; set; }

    public int IsAssigned { get; set; }
}

public record ApproveReq(List<int> InstructorIds, string? Note);
public record ReminderReq(bool OnlyNotResponded);

public sealed class FairnessRowDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string? Email { get; set; }
    public int ApprovedInMonth { get; set; }
}

public sealed class InstanceFairnessDto
{
    public int InstructorId { get; set; }
    public int ApprovedCount { get; set; }
}

public sealed class DeleteInstanceReq
{
    public string? Reason { get; set; }
}

public sealed class DeleteActivityReq
{
    public string? Reason { get; set; }
}
