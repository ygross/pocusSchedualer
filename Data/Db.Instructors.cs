using Dapper;

public sealed partial class Db
{
    public async Task<List<string>> GetInstructorCertificationsAsync(int instructorId)
    {
        const string sql = @"
SELECT at.TypeName
FROM dbo.InstructorActivityTypes iat
JOIN dbo.ActivityTypes at ON at.ActivityTypeId = iat.ActivityTypeId
WHERE iat.InstructorId = @InstructorId
ORDER BY at.TypeName;";

        await using var c = Open();
        var rows = await c.QueryAsync<string>(sql, new { InstructorId = instructorId });
        return rows.ToList();
    }
}
