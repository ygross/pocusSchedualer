public class ActorDto
{
    public int ActorId { get; set; }
    public string FullName { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string Gender { get; set; } = "Male";   // Male / Female / Other
    public string AgeGroup { get; set; } = "Adult"; // Adult / Child / Elderly
    public string Status { get; set; } = "active";  // active / inactive
    public string? Notes { get; set; }
}

public class ActorUpsertDto
{
    public string FullName { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string Gender { get; set; } = "Male";
    public string AgeGroup { get; set; } = "Adult";
    public string Status { get; set; } = "active";
    public string? Notes { get; set; }
}

public class ActorAvailabilityDto
{
    public int AvailabilityId { get; set; }
    public int ActorId { get; set; }
    public string ActorName { get; set; } = "";
    public string Gender { get; set; } = "";
    public string AgeGroup { get; set; } = "";
    public int InstanceId { get; set; }
    public string Status { get; set; } = "Submitted"; // Submitted / Approved / Rejected
    public string? Note { get; set; }
    public DateTime SubmittedAt { get; set; }
    public bool IsAssigned { get; set; }
}

public class ActorAssignmentDto
{
    public int AssignmentId { get; set; }
    public int InstanceId { get; set; }
    public int ActorId { get; set; }
    public string ActorName { get; set; } = "";
    public string Gender { get; set; } = "";
    public string AgeGroup { get; set; } = "";
    public string? DecisionNote { get; set; }
    public DateTime AssignedAt { get; set; }
}

public class ActorAssignRequest
{
    public int ActorId { get; set; }
    public string? DecisionNote { get; set; }
}

public class ActorAvailabilitySubmitRequest
{
    public string? Note { get; set; }
}

public class UpcomingInstanceDto
{
    public int InstanceId { get; set; }
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public string CourseName { get; set; } = "";
    public string TypeName { get; set; } = "";
    public DateTime StartUtc { get; set; }
    public DateTime? EndUtc { get; set; }
}
