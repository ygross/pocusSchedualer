using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

public sealed partial class Db
{
    public async Task<List<CourseDto>> GetCoursesAsync()
    {
        const string sql = @"
SELECT CourseId, CourseName, ActivityTypeId
FROM dbo.Courses
ORDER BY CourseName;";
        await using var c = Open();
        return (await c.QueryAsync<CourseDto>(sql)).AsList();
    }

    public async Task<List<InstructorDto>> GetInstructorsAsync()
    {
        const string sql = @"
SELECT
    InstructorId,
    FullName,
    Email,
    Phone,
    Department,
    [Role] AS RoleName,
    [Status]
FROM dbo.Instructors
ORDER BY FullName;";
        await using var c = Open();
        return (await c.QueryAsync<InstructorDto>(sql)).AsList();
    }

    public async Task<List<int>> GetInstructorIdsForCourseAsync(int courseId)
    {
        const string sql = @"
SELECT InstructorId
FROM dbo.InstructorCourses
WHERE CourseId = @courseId;";
        await using var c = Open();
        return (await c.QueryAsync<int>(sql, new { courseId })).AsList();
    }

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
                await c.ExecuteAsync(insertSql, new { courseId, instructorId }, tx);

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

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

    public async Task<MeDto?> GetMeByEmailAsync(string email)
    {
        const string sqlInstructor = @"
SELECT TOP 1
  InstructorId,
  Email,
  FullName,
  [Role] AS RoleName,
  Department,
  [Status]
FROM dbo.Instructors
WHERE Email = @email;";
        await using var c = Open();
        var inst = await c.QueryFirstOrDefaultAsync<MeDto>(sqlInstructor, new { email });
        if (inst != null) return inst;

        const string sqlActor = @"
SELECT TOP 1
  ActorId  AS InstructorId,
  Email,
  FullName,
  'Actor'  AS RoleName,
  NULL     AS Department,
  [Status]
FROM dbo.Actors
WHERE Email = @email;";
        return await c.QueryFirstOrDefaultAsync<MeDto>(sqlActor, new { email });
    }

    public async Task<MeDto?> ImpersonateByEmailAsync(string email)
        => await GetMeByEmailAsync(email);

    public async Task<MeDto?> GetInstructorByIdAsync(int instructorId)
    {
        const string sql = @"
SELECT TOP 1
  InstructorId, Email, FullName,
  [Role] AS RoleName, Department, [Status]
FROM dbo.Instructors
WHERE InstructorId = @instructorId;";
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<MeDto>(sql, new { instructorId });
    }

    public async Task<IEnumerable<ActivityTypeDto>> GetActivityTypesAsync()
    {
        const string sql = @"SELECT ActivityTypeId, TypeName FROM dbo.ActivityTypes ORDER BY TypeName;";
        await using var c = Open();
        return await c.QueryAsync<ActivityTypeDto>(sql);
    }

    public async Task<int> CreateActivityTypeAsync(string typeName)
    {
        const string sql = @"
INSERT INTO dbo.ActivityTypes (TypeName)
VALUES (@typeName);
SELECT CAST(SCOPE_IDENTITY() as int);";

        await using var c = Open();
        return await c.QuerySingleAsync<int>(sql, new { typeName });
    }

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
