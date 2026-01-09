public class OtpRequestDto
{
    public string Email { get; set; } = "";
}

public class OtpVerifyDto
{
    public string Email { get; set; } = "";
    public string Code { get; set; } = "";
}

public class MeDto
{
    public int InstructorId { get; set; }
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string RoleName { get; set; } = "";
    public string? Department { get; set; }
}

public record ImpersonateReq(string Email);
