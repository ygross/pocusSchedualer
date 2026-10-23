public sealed class AdminCourseInstructorRowDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Department { get; set; }
    public string? RoleName { get; set; }
    public string Status { get; set; } = "Inactive";
    public List<int> CourseIds { get; set; } = new();
    public List<string> CourseNames { get; set; } = new();
}

public sealed class AdminCourseDto
{
    public int CourseId { get; set; }
    public string CourseName { get; set; } = "";
    public int? ActivityTypeId { get; set; }
    public List<int> InstructorIds { get; set; } = new();
}

public sealed class AdminInstructorStatusDto
{
    public string Status { get; set; } = "";
}

public sealed class AdminInstructorCoursesDto
{
    public List<int> CourseIds { get; set; } = new();
}

public sealed class AdminCourseInstructorsSaveDto
{
    public List<int> InstructorIds { get; set; } = new();
}
