using System;

namespace PocusSchedualer.Models.Dtos;

public class AdminHoursReportRowDto
{
    public int InstructorId { get; set; }
    public string InstructorName { get; set; } = "";
    public string Role { get; set; } = "";
    public string Department { get; set; } = "";
    public int? CourseId { get; set; }
    public string CourseName { get; set; } = "";
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public double Hours { get; set; }
    public string AssignmentStatus { get; set; } = "";
}
