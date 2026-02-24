public class InstructorOnboardRequestDto
{
    public string Email { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string? Phone { get; set; }
    public string? Department { get; set; }

    /// <summary>
    /// Expected values: "Instructor" | "CourseManager" (see <see cref="Roles"/>).
    /// </summary>
    public string Role { get; set; } = Roles.Instructor;
}

public class InstructorAuthStateDto
{
    public int InstructorId { get; set; }
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string RoleName { get; set; } = "";
    public string? Department { get; set; }
    public string Status { get; set; } = "";
}
