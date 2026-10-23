using Dapper;

public sealed partial class Db
{
    public sealed class PendingInstructorRow
    {
        public int InstructorId { get; set; }
        public string Email { get; set; } = "";
        public string FullName { get; set; } = "";
        public string? Phone { get; set; }
        public string? Department { get; set; }
        public string RoleName { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTime CreatedAtUtc { get; set; }
    }

    public async Task<IReadOnlyList<PendingInstructorRow>> GetPendingInstructorsAsync()
    {
        const string sql = @"
SELECT
  InstructorId,
  Email,
  FullName,
  Phone,
  Department,
  [Role] AS RoleName,
  [Status],
  CreatedAtUtc
FROM dbo.Instructors
WHERE [Status] = @status
ORDER BY CreatedAtUtc DESC;
";
        await using var c = Open();
        var rows = await c.QueryAsync<PendingInstructorRow>(sql, new { status = "PendingApproval" });
        return rows.AsList();
    }

    public async Task<int> SetInstructorStatusAsync(int instructorId, string status)
    {
        const string sql = @"
UPDATE dbo.Instructors
SET [Status] = @status,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE InstructorId = @instructorId;
";
        await using var c = Open();
        return await c.ExecuteAsync(sql, new { instructorId, status });
    }
}
