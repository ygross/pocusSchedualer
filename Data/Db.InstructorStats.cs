// Data/Db.InstructorStats.cs
// מותאם למבנה שלך: Db משתמש ב-Open() (SqlConnection) + Dapper
// כולל: Stats רגיל + Certifications + Debug (מומלץ זמנית עד שהכל עובד)

using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Dapper;
using PocusSchedualer.Api.Dtos;

public sealed partial class Db
{
    /// <summary>
    /// מחזיר סטטיסטיקה למדריך בטווח תאריכים:
    /// - TotalInstances: כמות מופעים (Unique InstanceId)
    /// - TotalHours: סך שעות הדרכה (EndUtc-StartUtc)
    /// - ByActivity: פילוח לפי ActivityName (מופעים/שעות)
    /// מסנן:
    /// - Assignments.Status='Approved'
    /// - Assignments.CancelledAtUtc IS NULL
    /// - ActivityInstances.IsCancelled=0
    /// </summary>
    public async Task<InstructorStatsDto> GetInstructorStatsAsync(
        int instructorId,
        DateTime fromUtc,
        DateTime toUtc)
    {
        const string sql = @"
SELECT
    a.ActivityName AS ActivityName,
    COUNT(DISTINCT i.InstanceId) AS Instances,
    CAST(SUM(DATEDIFF(MINUTE, i.StartUtc, i.EndUtc)) AS decimal(18,2)) / 60.0 AS Hours
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
JOIN dbo.Activities a ON a.ActivityId = i.ActivityId
WHERE
    asg.InstructorId = @InstructorId
    AND asg.Status = N'Approved'
    AND asg.CancelledAtUtc IS NULL
    AND i.IsCancelled = 0
    AND i.StartUtc >= @FromUtc AND i.StartUtc < @ToUtc
GROUP BY
    a.ActivityName
ORDER BY
    a.ActivityName;";

        await using var c = Open();

        var rows = (await c.QueryAsync<InstructorActivityRowDto>(sql, new
        {
            InstructorId = instructorId,
            FromUtc = fromUtc,
            ToUtc = toUtc
        })).ToList();

        var totalInstances = rows.Sum(x => x.Instances);
        var totalHours = rows.Sum(x => x.Hours);

        return new InstructorStatsDto(totalInstances, totalHours, rows);
    }

    /// <summary>


    /// <summary>
    /// DEBUG זמני:
    /// עוזר להבין למה הסטטיסטיקה יוצאת 0 (InstructorId לא נכון / DB אחר / Status שונה / join ריק / טווח זמן)
    /// מומלץ להוריד לאחר שהכל עובד.
    /// </summary>
    public async Task<object> GetInstructorStatsDebugAsync(int instructorId, DateTime fromUtc, DateTime toUtc)
    {
        await using var c = Open();

        // 1) כמה Assignments יש למדריך (ללא joins)
        var totalAssignments = await c.ExecuteScalarAsync<int>(@"
SELECT COUNT(*) 
FROM dbo.Assignments 
WHERE InstructorId = @InstructorId;", new { InstructorId = instructorId });

        // 2) פילוח סטטוסים קיימים בפועל
        var statuses = (await c.QueryAsync(@"
SELECT Status, COUNT(*) AS Cnt
FROM dbo.Assignments
WHERE InstructorId = @InstructorId
GROUP BY Status
ORDER BY COUNT(*) DESC;", new { InstructorId = instructorId })).ToList();

        // 3) join ל-Instances בלי סינון Status/Date
        var joinAll = await c.ExecuteScalarAsync<int>(@"
SELECT COUNT(*)
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
WHERE asg.InstructorId = @InstructorId
  AND asg.CancelledAtUtc IS NULL
  AND i.IsCancelled = 0;", new { InstructorId = instructorId });

        // 4) join עם Approved + טווח זמן
        var joinFiltered = await c.ExecuteScalarAsync<int>(@"
SELECT COUNT(*)
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
WHERE asg.InstructorId = @InstructorId
  AND asg.Status = N'Approved'
  AND asg.CancelledAtUtc IS NULL
  AND i.IsCancelled = 0
  AND i.StartUtc >= @FromUtc AND i.StartUtc < @ToUtc;", new
        {
            InstructorId = instructorId,
            FromUtc = fromUtc,
            ToUtc = toUtc
        });

        // 5) מינ/מקס תאריכים למופעים המחוברים (אחרי joinAll)
        var minMax = await c.QueryFirstOrDefaultAsync(@"
SELECT
  MIN(i.StartUtc) AS MinStartUtc,
  MAX(i.StartUtc) AS MaxStartUtc
FROM dbo.Assignments asg
JOIN dbo.ActivityInstances i ON i.InstanceId = asg.InstanceId
WHERE asg.InstructorId = @InstructorId
  AND asg.CancelledAtUtc IS NULL
  AND i.IsCancelled = 0;", new { InstructorId = instructorId });

        return new
        {
            instructorId,
            fromUtc,
            toUtc,
            totalAssignments,
            statuses,
            joinAll,
            joinFiltered,
            minMax
        };
    }
}
