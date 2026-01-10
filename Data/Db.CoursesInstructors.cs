using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// Courses / instructors (including certifications mapping).
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Returns all courses (ordered by name).
    /// </summary>
    public async Task<List<CourseDto>> GetCoursesAsync()
    {
        const string sql = @"
SELECT CourseId, CourseName, ActivityTypeId
FROM dbo.Courses
ORDER BY CourseName;";
        await using var c = Open();
        return (await c.QueryAsync<CourseDto>(sql)).AsList();
    }

    /// <summary>
    /// Returns all instructors (ordered by full name).
    /// </summary>
    public async Task<List<InstructorDto>> GetInstructorsAsync()
    {
        const string sql = @"
SELECT InstructorId, FullName, Email
FROM dbo.Instructors
ORDER BY FullName;";
        await using var c = Open();
        return (await c.QueryAsync<InstructorDto>(sql)).AsList();
    }

    /// <summary>
    /// Returns instructor IDs certified for a course.
    /// </summary>
    public async Task<List<int>> GetInstructorIdsForCourseAsync(int courseId)
    {
        const string sql = @"
SELECT InstructorId
FROM dbo.InstructorCourses
WHERE CourseId = @courseId;";
        await using var c = Open();
        return (await c.QueryAsync<int>(sql, new { courseId })).AsList();
    }

    /// <summary>
    /// Sets the instructor list for a course (replaces existing mapping) in a transaction.
    /// </summary>
    public async Task SetCourseInstructorsAsync(int courseId, List<int> instructorIds)
    {
        const string deleteSql = @"
DELETE FROM dbo.InstructorCourses
WHERE CourseId = @courseId;";

        const string insertSql = @"
INSERT INTO dbo.InstructorCourses (CourseId, InstructorId)
VALUES (@courseId, @instructorId);";

        await using var c = Open();
        using var tx = c.BeginTransaction();

        try
        {
            await c.ExecuteAsync(deleteSql, new { courseId }, tx);

            foreach (var instructorId in instructorIds)
            {
                await c.ExecuteAsync(insertSql, new { courseId, instructorId }, tx);
            }

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    /// <summary>
    /// Returns courses filtered by activity type.
    /// </summary>
    public async Task<IEnumerable<CourseDto>> GetCoursesByActivityTypeAsync(int activityTypeId)
    {
        const string sql = @"
SELECT CourseId, CourseName, ActivityTypeId
FROM dbo.Courses
WHERE ActivityTypeId=@activityTypeId
ORDER BY CourseName;";

        await using var c = Open();
        return await c.QueryAsync<CourseDto>(sql, new { activityTypeId });
    }

    /// <summary>
    /// Returns instructors certified for a given course.
    /// </summary>
    public async Task<IEnumerable<InstructorDto>> GetInstructorsByCourseAsync(int courseId)
    {
        const string sql = @"
SELECT i.InstructorId, i.FullName, i.Email
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ci ON ci.InstructorId=i.InstructorId
WHERE ci.CourseId=@courseId
ORDER BY i.FullName;";

        await using var c = Open();
        return await c.QueryAsync<InstructorDto>(sql, new { courseId });
    }

    /// <summary>
    /// "Me" lookup by email (used by /me and auth flows).
    /// </summary>
    public async Task<MeDto?> GetMeByEmailAsync(string email)
    {
        const string sql = @"
SELECT TOP 1
  InstructorId,
  Email,
  FullName,
  [Role] AS RoleName,
  Department
FROM dbo.Instructors
WHERE Email = @email;";
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<MeDto>(sql, new { email });
    }

    /// <summary>
    /// Temporary impersonation wrapper (currently same as <see cref="GetMeByEmailAsync"/>).
    /// </summary>
    public async Task<MeDto?> ImpersonateByEmailAsync(string email)
        => await GetMeByEmailAsync(email);

    /// <summary>
    /// Returns all activity types.
    /// </summary>
    public async Task<IEnumerable<ActivityTypeDto>> GetActivityTypesAsync()
    {
        const string sql = @"SELECT ActivityTypeId, TypeName FROM dbo.ActivityTypes ORDER BY TypeName;";
        await using var c = Open();
        return await c.QueryAsync<ActivityTypeDto>(sql);
    }

    /// <summary>
    /// Creates a new activity type.
    /// </summary>
    public async Task<int> CreateActivityTypeAsync(string typeName)
    {
        const string sql = @"
INSERT INTO dbo.ActivityTypes (TypeName)
VALUES (@typeName);
SELECT CAST(SCOPE_IDENTITY() as int);";

        await using var c = Open();
        return await c.QuerySingleAsync<int>(sql, new { typeName });
    }

    /// <summary>
    /// Updates an activity type name.
    /// </summary>
    public async Task<bool> UpdateActivityTypeAsync(int id, string typeName)
    {
        const string sql = @"
UPDATE dbo.ActivityTypes
SET TypeName = @typeName
WHERE ActivityTypeId = @id;";

        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new { id, typeName });
        return rows > 0;
    }

    /// <summary>
    /// Returns true if an activity type has courses linked to it (guard against deletion).
    /// </summary>
    public async Task<bool> ActivityTypeHasCoursesAsync(int id)
    {
        const string sql = @"
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM dbo.Courses WHERE ActivityTypeId = @id
) THEN 1 ELSE 0 END;";

        await using var c = Open();
        var x = await c.QuerySingleAsync<int>(sql, new { id });
        return x == 1;
    }

    /// <summary>
    /// Deletes an activity type if it has no dependent courses.
    /// </summary>
    public async Task<(bool Ok, string? Error)> DeleteActivityTypeAsync(int id)
    {
        if (await ActivityTypeHasCoursesAsync(id))
            return (false, "לא ניתן למחוק: קיימים קורסים המשויכים לסוג פעילות זה.");

        const string sql = @"
DELETE FROM dbo.ActivityTypes
WHERE ActivityTypeId = @id;";

        await using var c = Open();
        var rows = await c.ExecuteAsync(sql, new { id });
        return rows > 0 ? (true, null) : (false, "סוג פעילות לא נמצא.");
    }
}
