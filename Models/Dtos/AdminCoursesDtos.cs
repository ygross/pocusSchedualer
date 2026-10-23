public sealed class AdminCourseRowDto
{
    public int CourseId { get; set; }
    public string CourseName { get; set; } = "";
    public string? CourseCode { get; set; }
    public int ActivityTypeId { get; set; }
    public string ActivityTypeName { get; set; } = "";
    public bool IsActive { get; set; }
    public int? DefaultLeadInstructorId { get; set; }
    public string? DefaultLeadName { get; set; }
    public int ActivitiesCount { get; set; }
    public int InstructorsCount { get; set; }
}

public sealed class AdminCourseUpsertDto
{
    public string CourseName { get; set; } = "";
    public string? CourseCode { get; set; }
    public int ActivityTypeId { get; set; }
    public bool IsActive { get; set; } = true;
    public int? DefaultLeadInstructorId { get; set; }
}

public sealed class AdminDeleteResultDto
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public int ActivitiesCount { get; set; }
    public int InstructorsCount { get; set; }
}

public sealed class CourseManagerPickDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
}
