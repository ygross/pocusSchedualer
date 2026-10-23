using Dapper;

public sealed partial class Db
{
    public async Task<List<InstructorCertificationDto>> GetInstructorCertificationsAsync(int instructorId)
    {
        const string sql = @"
SELECT at.ActivityTypeId, at.TypeName
FROM dbo.InstructorActivityTypes iat
JOIN dbo.ActivityTypes at ON at.ActivityTypeId = iat.ActivityTypeId
WHERE iat.InstructorId = @InstructorId
ORDER BY at.TypeName;";

        await using var c = Open();
        var rows = await c.QueryAsync<InstructorCertificationDto>(sql, new { InstructorId = instructorId });
        return rows.ToList();
    }

    public async Task<bool> UpdateInstructorSelfAsync(int instructorId, string fullName, string? phone, string? department)
    {
        const string sql = @"
UPDATE dbo.Instructors
SET FullName    = @fullName,
    Phone       = @phone,
    Department  = @department,
    UpdatedAtUtc = SYSUTCDATETIME()
WHERE InstructorId = @instructorId;";
        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new { instructorId, fullName, phone, department });
        return rows > 0;
    }

    public async Task SetInstructorCertificationsAsync(int instructorId, IReadOnlyCollection<int> activityTypeIds)
    {
        const string deleteSql = @"DELETE FROM dbo.InstructorActivityTypes WHERE InstructorId = @InstructorId;";
        const string insertSql = @"
INSERT INTO dbo.InstructorActivityTypes (InstructorId, ActivityTypeId)
VALUES (@InstructorId, @ActivityTypeId);";

        await using var c = Open();
        using var tx = c.BeginTransaction();
        try
        {
            await c.ExecuteAsync(deleteSql, new { InstructorId = instructorId }, tx);

            foreach (var activityTypeId in activityTypeIds.Distinct())
            {
                await c.ExecuteAsync(insertSql, new { InstructorId = instructorId, ActivityTypeId = activityTypeId }, tx);
            }

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}

public sealed class InstructorCertificationDto
{
    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = string.Empty;
}
