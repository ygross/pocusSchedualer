using Dapper;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public sealed partial class Db
{
    /// <summary>
    /// מחזיר את הקורסים אליהם משויך המדריך
    /// </summary>
    public async Task<List<CourseMiniDto>> GetInstructorCoursesAsync(int instructorId)
    {
        const string sql = @"
SELECT
    c.CourseId,
    c.CourseName
FROM dbo.InstructorCourses ic
JOIN dbo.Courses c ON c.CourseId = ic.CourseId
WHERE ic.InstructorId = @InstructorId
  AND c.IsActive = 1
ORDER BY c.CourseName;
";

        await using var c = Open();
        var rows = await c.QueryAsync<CourseMiniDto>(sql, new { InstructorId = instructorId });
        return rows.ToList();
    }
}

/// <summary>
/// DTO קטן להצגת קורסים כ-pills
/// </summary>
public sealed record CourseMiniDto(int CourseId, string CourseName);
