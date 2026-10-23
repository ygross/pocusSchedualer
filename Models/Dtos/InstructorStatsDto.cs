namespace PocusSchedualer.Api.Dtos;

public record InstructorStatsDto(
    int TotalInstances,
    decimal TotalHours,
    int DistinctActivities,
    List<InstructorActivityRowDto> ByActivity,
    List<string> Certifications
);

public record InstructorActivityRowDto(
    string ActivityName,
    DateTime StartUtc,
    decimal Hours
);

public class MyAssignmentRowDto
{
    public int AssignmentId { get; set; }
    public int InstanceId   { get; set; }
    public string ActivityName { get; set; } = "";
    public DateTime StartUtc   { get; set; }
    public DateTime EndUtc     { get; set; }
    public string Status       { get; set; } = "";
}
