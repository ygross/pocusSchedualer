using Dapper;

public sealed partial class Db
{
    public const string InstructorStatus_Approved = "Approved";
    public const string InstructorStatus_PendingApproval = "PendingApproval";
    public const string InstructorStatus_Declined = "Declined";

    /// <summary>
    /// Lightweight lookup for onboarding/login flow.
    /// </summary>
    public async Task<InstructorAuthStateDto?> GetInstructorAuthStateByEmailAsync(string email)
    {
        const string sqlInstructor = @"
SELECT TOP 1
  InstructorId,
  Email,
  FullName,
  [Role] AS RoleName,
  Department,
  [Status]
FROM dbo.Instructors
WHERE Email = @email;";

        await using var c = Open();
        var inst = await c.QueryFirstOrDefaultAsync<InstructorAuthStateDto>(sqlInstructor, new { email });
        if (inst != null) return inst;

        // fallback: check Actors table
        const string sqlActor = @"
SELECT TOP 1
  ActorId  AS InstructorId,
  Email,
  FullName,
  'Actor'  AS RoleName,
  NULL     AS Department,
  [Status]
FROM dbo.Actors
WHERE Email = @email;";
        return await c.QueryFirstOrDefaultAsync<InstructorAuthStateDto>(sqlActor, new { email });
    }

    /// <summary>
    /// Creates a new instructor in PendingApproval status (idempotent: if email exists, no insert is performed).
    /// Returns the InstructorId.
    /// </summary>
    public async Task<int> CreatePendingInstructorAsync(
        string email,
        string firstName,
        string lastName,
        string role,
        string? phone,
        string? department)
    {
        // Defensive normalization
        email = (email ?? "").Trim().ToLowerInvariant();
        firstName = (firstName ?? "").Trim();
        lastName = (lastName ?? "").Trim();
        role = (role ?? "").Trim();
        phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        department = string.IsNullOrWhiteSpace(department) ? null : department.Trim();

        var fullName = (firstName + " " + lastName).Trim();

        const string sql = @"
IF EXISTS (SELECT 1 FROM dbo.Instructors WHERE Email=@email)
BEGIN
  SELECT CAST((SELECT TOP 1 InstructorId FROM dbo.Instructors WHERE Email=@email) AS int);
END
ELSE
BEGIN
  INSERT INTO dbo.Instructors
    (Email, FullName, Phone, Department, [Role], [Status], CreatedAtUtc, UpdatedAtUtc)
  VALUES
    (@email, @fullName, @phone, @department, @role, @status, SYSUTCDATETIME(), SYSUTCDATETIME());

  SELECT CAST(SCOPE_IDENTITY() AS int);
END
";

        await using var c = Open();
        return await c.QuerySingleAsync<int>(sql, new
        {
            email,
            fullName,
            phone,
            department,
            role,
            status = InstructorStatus_PendingApproval
        });
    }
}
