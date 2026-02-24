/// <summary>
/// Represents a single approved assignment for the currently logged-in instructor.
/// Used by GET /api/assignments/my (my-assignments.html page).
/// </summary>
public class MyAssignmentDto
{
    public int AssignmentId { get; set; }
    public string Status { get; set; } = "";
    public DateTime AssignedAtUtc { get; set; }

    // Instance details
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }

    // Activity details
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public string TypeName { get; set; } = "";
    public string? CourseName { get; set; }

    // Lead info
    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }
}
