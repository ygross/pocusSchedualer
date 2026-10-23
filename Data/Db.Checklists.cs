using Dapper;

/// <summary>
/// DB access for the Checklists feature:
/// create/edit checklists with items, assign to courses, track per-course progress.
/// </summary>
public sealed partial class Db
{
    // ── Checklists ────────────────────────────────────────────────────────────

    public async Task<List<ChecklistRowDto>> GetChecklistsAsync()
    {
        const string sql = @"
SELECT
    cl.ChecklistId,
    cl.Title,
    cl.Description,
    cl.CreatedAtUtc,
    ISNULL(i.FullName, CAST(cl.CreatedById AS NVARCHAR(20))) AS CreatedByName,
    (SELECT COUNT(*) FROM dbo.ChecklistItems   WHERE ChecklistId = cl.ChecklistId) AS ItemCount,
    (SELECT COUNT(*) FROM dbo.ChecklistCourseLinks WHERE ChecklistId = cl.ChecklistId) AS CourseCount
FROM dbo.Checklists cl
LEFT JOIN dbo.Instructors i ON i.InstructorId = cl.CreatedById
ORDER BY cl.ChecklistId DESC;";

        await using var c = Open();
        return (await c.QueryAsync<ChecklistRowDto>(sql)).ToList();
    }

    public async Task<ChecklistDetailDto?> GetChecklistDetailAsync(int checklistId)
    {
        const string clSql = @"
SELECT cl.ChecklistId, cl.Title, cl.Description, cl.CreatedAtUtc,
       ISNULL(i.FullName, CAST(cl.CreatedById AS NVARCHAR(20))) AS CreatedByName
FROM dbo.Checklists cl
LEFT JOIN dbo.Instructors i ON i.InstructorId = cl.CreatedById
WHERE cl.ChecklistId = @checklistId;";

        const string itemSql = @"
SELECT ItemId, ChecklistId, ItemText, SortOrder
FROM dbo.ChecklistItems
WHERE ChecklistId = @checklistId
ORDER BY SortOrder, ItemId;";

        const string courseSql = @"
SELECT
    ccl.LinkId, ccl.ChecklistId, ccl.CourseId,
    c.CourseName,
    ccl.LinkedAtUtc,
    (SELECT COUNT(*) FROM dbo.ChecklistItems WHERE ChecklistId = ccl.ChecklistId) AS TotalItems,
    (SELECT COUNT(*) FROM dbo.ChecklistProgress cp
     WHERE cp.LinkId = ccl.LinkId AND cp.IsChecked = 1) AS CheckedItems
FROM dbo.ChecklistCourseLinks ccl
JOIN dbo.Courses c ON c.CourseId = ccl.CourseId
WHERE ccl.ChecklistId = @checklistId
ORDER BY ccl.LinkId;";

        await using var c = Open();
        var cl = await c.QueryFirstOrDefaultAsync<ChecklistDetailDto>(clSql, new { checklistId });
        if (cl == null) return null;

        cl.Items   = (await c.QueryAsync<ChecklistItemDto>(itemSql, new { checklistId })).ToList();
        cl.Courses = (await c.QueryAsync<ChecklistCourseDto>(courseSql, new { checklistId })).ToList();
        return cl;
    }

    public async Task<int> CreateChecklistAsync(string title, string? description, int? createdById)
    {
        const string sql = @"
INSERT INTO dbo.Checklists(Title, Description, CreatedById, CreatedAtUtc)
OUTPUT INSERTED.ChecklistId
VALUES(@title, @description, @createdById, SYSUTCDATETIME());";

        await using var c = Open();
        return await c.QuerySingleAsync<int>(sql, new { title, description, createdById });
    }

    public async Task<bool> UpdateChecklistAsync(int checklistId, string title, string? description)
    {
        const string sql = @"
UPDATE dbo.Checklists SET Title=@title, Description=@description
WHERE ChecklistId=@checklistId;";

        await using var c = Open();
        return await c.ExecuteAsync(sql, new { checklistId, title, description }) > 0;
    }

    public async Task<bool> DeleteChecklistAsync(int checklistId)
    {
        await using var c = Open();
        using var tx = c.BeginTransaction();
        try
        {
            // delete progress → items → links → checklist
            await c.ExecuteAsync(@"
DELETE cp FROM dbo.ChecklistProgress cp
JOIN dbo.ChecklistCourseLinks ccl ON ccl.LinkId = cp.LinkId
WHERE ccl.ChecklistId = @checklistId;", new { checklistId }, tx);

            await c.ExecuteAsync(
                "DELETE FROM dbo.ChecklistItems WHERE ChecklistId=@checklistId;",
                new { checklistId }, tx);

            await c.ExecuteAsync(
                "DELETE FROM dbo.ChecklistCourseLinks WHERE ChecklistId=@checklistId;",
                new { checklistId }, tx);

            var rows = await c.ExecuteAsync(
                "DELETE FROM dbo.Checklists WHERE ChecklistId=@checklistId;",
                new { checklistId }, tx);

            tx.Commit();
            return rows > 0;
        }
        catch { tx.Rollback(); throw; }
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public async Task<int> AddChecklistItemAsync(int checklistId, string itemText, int sortOrder)
    {
        const string sql = @"
INSERT INTO dbo.ChecklistItems(ChecklistId, ItemText, SortOrder, CreatedAtUtc)
OUTPUT INSERTED.ItemId
VALUES(@checklistId, @itemText, @sortOrder, SYSUTCDATETIME());";

        await using var c = Open();
        return await c.QuerySingleAsync<int>(sql, new { checklistId, itemText, sortOrder });
    }

    public async Task<bool> UpdateChecklistItemAsync(int itemId, string itemText, int sortOrder)
    {
        const string sql = @"
UPDATE dbo.ChecklistItems SET ItemText=@itemText, SortOrder=@sortOrder
WHERE ItemId=@itemId;";

        await using var c = Open();
        return await c.ExecuteAsync(sql, new { itemId, itemText, sortOrder }) > 0;
    }

    public async Task<bool> DeleteChecklistItemAsync(int itemId)
    {
        await using var c = Open();
        // delete progress rows for this item first
        await c.ExecuteAsync(
            "DELETE FROM dbo.ChecklistProgress WHERE ItemId=@itemId;",
            new { itemId });
        return await c.ExecuteAsync(
            "DELETE FROM dbo.ChecklistItems WHERE ItemId=@itemId;",
            new { itemId }) > 0;
    }

    // ── Course Assignments ────────────────────────────────────────────────────

    public async Task<(bool ok, int linkId, string? error)> AssignChecklistToCourseAsync(
        int checklistId, int courseId, int? linkedById)
    {
        // Check both exist
        await using var c = Open();
        var clExists = await c.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.Checklists WHERE ChecklistId=@checklistId;",
            new { checklistId });
        if (clExists == 0) return (false, 0, "ChecklistNotFound");

        var courseExists = await c.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.Courses WHERE CourseId=@courseId;",
            new { courseId });
        if (courseExists == 0) return (false, 0, "CourseNotFound");

        const string sql = @"
IF NOT EXISTS(SELECT 1 FROM dbo.ChecklistCourseLinks WHERE ChecklistId=@checklistId AND CourseId=@courseId)
BEGIN
    INSERT INTO dbo.ChecklistCourseLinks(ChecklistId, CourseId, LinkedById, LinkedAtUtc)
    VALUES(@checklistId, @courseId, @linkedById, SYSUTCDATETIME());
END
SELECT ISNULL(
    (SELECT LinkId FROM dbo.ChecklistCourseLinks WHERE ChecklistId=@checklistId AND CourseId=@courseId),
    0);";

        var linkId = await c.QuerySingleAsync<int>(sql, new { checklistId, courseId, linkedById });
        return (true, linkId, null);
    }

    public async Task<bool> UnassignChecklistFromCourseAsync(int linkId)
    {
        await using var c = Open();
        await c.ExecuteAsync(
            "DELETE FROM dbo.ChecklistProgress WHERE LinkId=@linkId;",
            new { linkId });
        return await c.ExecuteAsync(
            "DELETE FROM dbo.ChecklistCourseLinks WHERE LinkId=@linkId;",
            new { linkId }) > 0;
    }

    // ── Progress ──────────────────────────────────────────────────────────────

    public async Task<List<ChecklistProgressRowDto>> GetProgressAsync(int linkId)
    {
        const string sql = @"
SELECT
    ci.ItemId,
    ci.ItemText,
    ci.SortOrder,
    ISNULL(cp.IsChecked, 0)  AS IsChecked,
    ISNULL(i.FullName, '')   AS CheckedByName,
    cp.CheckedAtUtc
FROM dbo.ChecklistItems ci
JOIN dbo.ChecklistCourseLinks ccl ON ccl.ChecklistId = ci.ChecklistId
LEFT JOIN dbo.ChecklistProgress cp ON cp.LinkId = @linkId AND cp.ItemId = ci.ItemId
LEFT JOIN dbo.Instructors       i  ON i.InstructorId = cp.CheckedById
WHERE ccl.LinkId = @linkId
ORDER BY ci.SortOrder, ci.ItemId;";

        await using var c = Open();
        return (await c.QueryAsync<ChecklistProgressRowDto>(sql, new { linkId })).ToList();
    }

    public async Task ToggleProgressAsync(int linkId, int itemId, bool isChecked, int? checkedById)
    {
        const string sql = @"
MERGE dbo.ChecklistProgress AS tgt
USING (SELECT @linkId AS LinkId, @itemId AS ItemId) AS src
    ON tgt.LinkId = src.LinkId AND tgt.ItemId = src.ItemId
WHEN MATCHED THEN
    UPDATE SET IsChecked    = @isChecked,
               CheckedById  = CASE WHEN @isChecked=1 THEN @checkedById ELSE NULL END,
               CheckedAtUtc = CASE WHEN @isChecked=1 THEN SYSUTCDATETIME() ELSE NULL END,
               UpdatedAtUtc = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (LinkId, ItemId, IsChecked, CheckedById, CheckedAtUtc, UpdatedAtUtc)
    VALUES (@linkId, @itemId, @isChecked,
            CASE WHEN @isChecked=1 THEN @checkedById ELSE NULL END,
            CASE WHEN @isChecked=1 THEN SYSUTCDATETIME() ELSE NULL END,
            SYSUTCDATETIME());";

        await using var c = Open();
        await c.ExecuteAsync(sql, new { linkId, itemId, isChecked, checkedById });
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public class ChecklistRowDto
{
    public int      ChecklistId    { get; set; }
    public string   Title          { get; set; } = "";
    public string?  Description    { get; set; }
    public string?  CreatedByName  { get; set; }
    public int      ItemCount      { get; set; }
    public int      CourseCount    { get; set; }
    public DateTime CreatedAtUtc   { get; set; }
}

public class ChecklistDetailDto : ChecklistRowDto
{
    public List<ChecklistItemDto>   Items   { get; set; } = new();
    public List<ChecklistCourseDto> Courses { get; set; } = new();
}

public class ChecklistItemDto
{
    public int    ItemId      { get; set; }
    public int    ChecklistId { get; set; }
    public string ItemText    { get; set; } = "";
    public int    SortOrder   { get; set; }
}

public class ChecklistCourseDto
{
    public int      LinkId       { get; set; }
    public int      ChecklistId  { get; set; }
    public int      CourseId     { get; set; }
    public string   CourseName   { get; set; } = "";
    public int      TotalItems   { get; set; }
    public int      CheckedItems { get; set; }
    public DateTime LinkedAtUtc  { get; set; }
}

public class ChecklistProgressRowDto
{
    public int      ItemId        { get; set; }
    public string   ItemText      { get; set; } = "";
    public int      SortOrder     { get; set; }
    public bool     IsChecked     { get; set; }
    public string   CheckedByName { get; set; } = "";
    public DateTime? CheckedAtUtc { get; set; }
}

// ── Upsert input DTOs ────────────────────────────────────────────────────────

public class ChecklistUpsertDto
{
    public string  Title       { get; set; } = "";
    public string? Description { get; set; }
}

public class ChecklistItemUpsertDto
{
    public string ItemText  { get; set; } = "";
    public int    SortOrder { get; set; }
}

public class ChecklistToggleDto
{
    public bool IsChecked { get; set; }
}
