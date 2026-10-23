using Dapper;

public sealed partial class Db
{
    public async Task<List<AdminCourseInstructorRowDto>> GetAdminCourseInstructorsAsync()
    {
        const string sql = @"
SELECT
    i.InstructorId,
    i.FullName,
    i.Email,
    i.Department,
    i.[Role] AS RoleName,
    ISNULL(i.[Status], 'Inactive') AS [Status],
    ic.CourseId,
    c.CourseName
FROM dbo.Instructors i
LEFT JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
LEFT JOIN dbo.Courses c ON c.CourseId = ic.CourseId
ORDER BY i.FullName, c.CourseName;";

        await using var c = Open();
        var rows = await c.QueryAsync(sql);

        var map = new Dictionary<int, AdminCourseInstructorRowDto>();
        foreach (var r in rows)
        {
            int id = (int)r.InstructorId;
            if (!map.TryGetValue(id, out var dto))
            {
                dto = new AdminCourseInstructorRowDto
                {
                    InstructorId = id,
                    FullName = (string?)r.FullName ?? "",
                    Email = (string?)r.Email ?? "",
                    Department = (string?)r.Department,
                    RoleName = (string?)r.RoleName,
                    Status = (string?)r.Status ?? "Inactive"
                };
                map[id] = dto;
            }

            if (r.CourseId != null)
            {
                var courseId = (int)r.CourseId;
                var courseName = (string?)r.CourseName ?? "";
                if (!dto.CourseIds.Contains(courseId)) dto.CourseIds.Add(courseId);
                if (!string.IsNullOrWhiteSpace(courseName) && !dto.CourseNames.Contains(courseName)) dto.CourseNames.Add(courseName);
            }
        }

        return map.Values.ToList();
    }

    public async Task<List<AdminCourseDto>> GetAdminCoursesWithInstructorIdsAsync()
    {
        const string sql = @"
SELECT
    c.CourseId,
    c.CourseName,
    c.ActivityTypeId,
    ic.InstructorId
FROM dbo.Courses c
LEFT JOIN dbo.InstructorCourses ic ON ic.CourseId = c.CourseId
ORDER BY c.CourseName;";

        await using var c = Open();
        var rows = await c.QueryAsync(sql);

        var map = new Dictionary<int, AdminCourseDto>();
        foreach (var r in rows)
        {
            int id = (int)r.CourseId;
            if (!map.TryGetValue(id, out var dto))
            {
                dto = new AdminCourseDto
                {
                    CourseId = id,
                    CourseName = (string?)r.CourseName ?? "",
                    ActivityTypeId = (int?)r.ActivityTypeId
                };
                map[id] = dto;
            }

            if (r.InstructorId != null)
            {
                var instructorId = (int)r.InstructorId;
                if (!dto.InstructorIds.Contains(instructorId))
                    dto.InstructorIds.Add(instructorId);
            }
        }

        return map.Values.ToList();
    }

    public async Task<int> UpdateInstructorStatusAdminAsync(int instructorId, string status)
        => await SetInstructorStatusAsync(instructorId, status);

    public async Task SaveInstructorCoursesAdminAsync(int instructorId, List<int> courseIds)
    {
        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            await c.ExecuteAsync(
                "DELETE FROM dbo.InstructorCourses WHERE InstructorId = @instructorId;",
                new { instructorId }, tx);

            foreach (var courseId in courseIds.Distinct().OrderBy(x => x))
            {
                await c.ExecuteAsync(
                    "INSERT INTO dbo.InstructorCourses (InstructorId, CourseId) VALUES (@instructorId, @courseId);",
                    new { instructorId, courseId }, tx);
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
