using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Dapper;
using PocusSchedualer.Api.Dtos;

public sealed partial class Db
{
    public async Task<InstructorStatsDto> GetInstructorStatsAsync(
        int instructorId,
        DateTime fromUtc,
        DateTime toUtc)
    {
        const string sql = @"
SELECT
    a.ActivityName,
    i.StartUtc,
    CAST(DATEDIFF(MINUTE, i.StartUtc, i.EndUtc) AS decimal(18,2)) / 60.0 AS Hours
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
JOIN dbo.Activities        a ON a.ActivityId  = i.ActivityId
WHERE
    asg.InstructorId      = @InstructorId
    AND asg.Status        = N'Approved'
    AND asg.CancelledAtUtc IS NULL
    AND i.IsCancelled     = 0
    AND i.StartUtc >= @FromUtc AND i.StartUtc < @ToUtc
ORDER BY i.StartUtc DESC;";

        await using var conn = Open();

        var rows = (await conn.QueryAsync<InstructorActivityRowDto>(sql, new
        {
            InstructorId = instructorId,
            FromUtc      = fromUtc,
            ToUtc        = toUtc
        })).ToList();

        var totalInstances   = rows.Count;
        var totalHours       = rows.Sum(x => x.Hours);
        var distinctActs     = rows.Select(x => x.ActivityName).Distinct().Count();
        var certDtos         = await GetInstructorCertificationsAsync(instructorId);
        var certNames        = certDtos.Select(x => x.TypeName).ToList();

        return new InstructorStatsDto(totalInstances, totalHours, distinctActs, rows, certNames);
    }

    public async Task<IEnumerable<MyAssignmentRowDto>> GetMyAssignmentsAsync(int instructorId)
    {
        const string sql = @"
SELECT
    asg.AssignmentId,
    i.InstanceId,
    a.ActivityName,
    i.StartUtc,
    i.EndUtc,
    asg.Status
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
JOIN dbo.Activities        a ON a.ActivityId  = i.ActivityId
WHERE asg.InstructorId    = @InstructorId
  AND asg.CancelledAtUtc IS NULL
  AND i.IsCancelled       = 0
ORDER BY i.StartUtc DESC;";

        await using var conn = Open();
        return await conn.QueryAsync<MyAssignmentRowDto>(sql, new { InstructorId = instructorId });
    }

    public async Task<object> GetInstructorStatsDebugAsync(int instructorId, DateTime fromUtc, DateTime toUtc)
    {
        await using var conn = Open();

        var totalAssignments = await conn.ExecuteScalarAsync<int>(@"
SELECT COUNT(*) FROM dbo.Assignments WHERE InstructorId = @InstructorId;",
            new { InstructorId = instructorId });

        var statuses = (await conn.QueryAsync(@"
SELECT Status, COUNT(*) AS Cnt
FROM dbo.Assignments WHERE InstructorId = @InstructorId
GROUP BY Status ORDER BY COUNT(*) DESC;",
            new { InstructorId = instructorId })).ToList();

        var joinAll = await conn.ExecuteScalarAsync<int>(@"
SELECT COUNT(*)
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
WHERE asg.InstructorId = @InstructorId AND asg.CancelledAtUtc IS NULL AND i.IsCancelled = 0;",
            new { InstructorId = instructorId });

        var joinFiltered = await conn.ExecuteScalarAsync<int>(@"
SELECT COUNT(*)
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
WHERE asg.InstructorId = @InstructorId AND asg.Status = N'Approved'
  AND asg.CancelledAtUtc IS NULL AND i.IsCancelled = 0
  AND i.StartUtc >= @FromUtc AND i.StartUtc < @ToUtc;",
            new { InstructorId = instructorId, FromUtc = fromUtc, ToUtc = toUtc });

        var minMax = await conn.QueryFirstOrDefaultAsync(@"
SELECT MIN(i.StartUtc) AS MinStartUtc, MAX(i.StartUtc) AS MaxStartUtc
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
WHERE asg.InstructorId = @InstructorId AND asg.CancelledAtUtc IS NULL AND i.IsCancelled = 0;",
            new { InstructorId = instructorId });

        return new { instructorId, fromUtc, toUtc, totalAssignments, statuses, joinAll, joinFiltered, minMax };
    }
}
