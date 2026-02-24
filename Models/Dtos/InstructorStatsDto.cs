namespace PocusSchedualer.Api.Dtos;

public record InstructorStatsDto(
    int TotalInstances,
    decimal TotalHours,
    List<InstructorActivityRowDto> ByActivity
);

public record InstructorActivityRowDto(
    string ActivityName,
    int Instances,
    decimal Hours
);
