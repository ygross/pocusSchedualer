using System.Collections.Generic;
using System.Data;
using Dapper;
using PocusSchedualer.Models.Dtos;

namespace PocusSchedualer.Data;

public static class DbAdminHoursReport
{
    public static async Task<IEnumerable<AdminHoursReportRowDto>> GetAsync(IDbConnection db)
    {
        const string sql = @"
SELECT
      i.InstructorId                                  AS InstructorId
    , i.FullName                                      AS InstructorName
    , i.[Role]                                        AS [Role]
    , ISNULL(i.Department, N'')                       AS Department
    , c.CourseId                                      AS CourseId
    , ISNULL(c.CourseName, N'')                       AS CourseName
    , a.ActivityId                                    AS ActivityId
    , a.ActivityName                                  AS ActivityName
    , ai.InstanceId                                   AS InstanceId
    , ai.StartUtc                                     AS StartUtc
    , ai.EndUtc                                       AS EndUtc
    , CAST(DATEDIFF(MINUTE, ai.StartUtc, ai.EndUtc) / 60.0 AS float) AS Hours
    , ass.[Status]                                    AS AssignmentStatus
FROM dbo.Assignments ass
INNER JOIN dbo.Instructors i
    ON i.InstructorId = ass.InstructorId
INNER JOIN dbo.ActivityInstances ai
    ON ai.InstanceId = ass.InstanceId
INNER JOIN dbo.Activities a
    ON a.ActivityId = ai.ActivityId
LEFT JOIN dbo.Courses c
    ON c.CourseId = a.CourseId
WHERE
       ass.[Status] = N'Approved'
   AND ass.CancelledAtUtc IS NULL
   AND ISNULL(ai.IsCancelled, 0) = 0
   AND ISNULL(a.IsCancelled, 0) = 0
ORDER BY ai.StartUtc DESC, i.FullName ASC;";

        return await db.QueryAsync<AdminHoursReportRowDto>(sql);
    }
}
