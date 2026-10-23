using Dapper;

public sealed partial class Db
{
    /// <summary>
    /// Inserts a single instructor if the email does not already exist.
    /// Returns (inserted=true, instructorId) if new, (inserted=false, existingId) if duplicate.
    /// </summary>
    public async Task<(bool Inserted, int InstructorId)> BulkImportInstructorAsync(
        string email,
        string fullName,
        string role,
        string? department,
        string? phone)
    {
        const string sql = @"
IF EXISTS (SELECT 1 FROM dbo.Instructors WHERE Email = @email)
BEGIN
    SELECT 0 AS Inserted,
           (SELECT TOP 1 InstructorId FROM dbo.Instructors WHERE Email = @email) AS InstructorId;
END
ELSE
BEGIN
    INSERT INTO dbo.Instructors
        (Email, FullName, Phone, Department, [Role], [Status], CreatedAtUtc, UpdatedAtUtc)
    VALUES
        (@email, @fullName, @phone, @department, @role, 'active', SYSUTCDATETIME(), SYSUTCDATETIME());

    SELECT 1 AS Inserted, CAST(SCOPE_IDENTITY() AS int) AS InstructorId;
END";

        await using var c = Open();
        var row = await c.QuerySingleAsync(sql, new { email, fullName, phone, department, role });
        return ((int)row.Inserted == 1, (int)row.InstructorId);
    }
}
