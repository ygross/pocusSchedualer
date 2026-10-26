using Dapper;
using System.Collections.Generic;
using System.Threading.Tasks;

public sealed partial class Db
{
    // ── Actors CRUD ──────────────────────────────────────────────────────────

    public async Task<List<ActorDto>> GetActorsAsync(string? gender = null, string? ageGroup = null, string? status = null)
    {
        const string sql = @"
SELECT ActorId, FullName, Email, Phone, Gender, AgeGroup, Status, Notes
FROM dbo.Actors
WHERE (@gender   IS NULL OR Gender   = @gender)
  AND (@ageGroup IS NULL OR AgeGroup = @ageGroup)
  AND (@status   IS NULL OR Status   = @status)
ORDER BY FullName;";
        await using var c = Open();
        return (await c.QueryAsync<ActorDto>(sql, new { gender, ageGroup, status })).AsList();
    }

    public async Task<ActorDto?> GetActorByIdAsync(int actorId)
    {
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<ActorDto>(
            "SELECT ActorId,FullName,Email,Phone,Gender,AgeGroup,Status,Notes FROM dbo.Actors WHERE ActorId=@actorId;",
            new { actorId });
    }

    public async Task<int> CreateActorAsync(ActorUpsertDto dto)
    {
        const string sql = @"
INSERT INTO dbo.Actors (FullName,Email,Phone,Gender,AgeGroup,Status,Notes,CreatedAtUtc)
VALUES (@FullName,@Email,@Phone,@Gender,@AgeGroup,@Status,@Notes,SYSUTCDATETIME());
SELECT SCOPE_IDENTITY();";
        await using var c = Open();
        return await c.ExecuteScalarAsync<int>(sql, dto);
    }

    public async Task<bool> UpdateActorAsync(int actorId, ActorUpsertDto dto)
    {
        const string sql = @"
UPDATE dbo.Actors
SET FullName=@FullName, Email=@Email, Phone=@Phone,
    Gender=@Gender, AgeGroup=@AgeGroup, Status=@Status,
    Notes=@Notes, UpdatedAtUtc=SYSUTCDATETIME()
WHERE ActorId=@actorId;";
        await using var c = Open();
        return await c.ExecuteAsync(sql, new { actorId, dto.FullName, dto.Email, dto.Phone, dto.Gender, dto.AgeGroup, dto.Status, dto.Notes }) > 0;
    }

    public async Task<bool> DeleteActorAsync(int actorId)
    {
        await using var c = Open();
        return await c.ExecuteAsync("DELETE FROM dbo.Actors WHERE ActorId=@actorId;", new { actorId }) > 0;
    }

    // ── Actor Availability ────────────────────────────────────────────────────

    public async Task<List<ActorAvailabilityDto>> GetActorAvailabilityForInstanceAsync(int instanceId)
    {
        const string sql = @"
SELECT
  av.AvailabilityId, av.ActorId, a.FullName AS ActorName,
  a.Gender, a.AgeGroup,
  av.InstanceId, av.Status, av.Note, av.SubmittedAt,
  CASE WHEN asgn.AssignmentId IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsAssigned
FROM dbo.ActorAvailability av
JOIN dbo.Actors a ON a.ActorId = av.ActorId
LEFT JOIN dbo.ActorAssignments asgn ON asgn.InstanceId = av.InstanceId AND asgn.ActorId = av.ActorId
WHERE av.InstanceId = @instanceId
ORDER BY a.FullName;";
        await using var c = Open();
        return (await c.QueryAsync<ActorAvailabilityDto>(sql, new { instanceId })).AsList();
    }

    public async Task<List<ActorAvailabilityDto>> GetMyActorAvailabilityAsync(int actorId)
    {
        const string sql = @"
SELECT
  av.AvailabilityId, av.ActorId, a.FullName AS ActorName,
  a.Gender, a.AgeGroup,
  av.InstanceId, av.Status, av.Note, av.SubmittedAt,
  CASE WHEN asgn.AssignmentId IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsAssigned
FROM dbo.ActorAvailability av
JOIN dbo.Actors a ON a.ActorId = av.ActorId
LEFT JOIN dbo.ActorAssignments asgn ON asgn.InstanceId = av.InstanceId AND asgn.ActorId = av.ActorId
WHERE av.ActorId = @actorId
ORDER BY av.SubmittedAt DESC;";
        await using var c = Open();
        return (await c.QueryAsync<ActorAvailabilityDto>(sql, new { actorId })).AsList();
    }

    public async Task UpsertActorAvailabilityAsync(int actorId, int instanceId, string? note)
    {
        const string sql = @"
MERGE dbo.ActorAvailability WITH (HOLDLOCK) AS t
USING (VALUES (@actorId, @instanceId)) AS s(ActorId, InstanceId)
  ON t.ActorId = s.ActorId AND t.InstanceId = s.InstanceId
WHEN MATCHED THEN
  UPDATE SET SubmittedAt = SYSUTCDATETIME(), Note = @note,
             Status = ISNULL(NULLIF(t.Status,''), 'Submitted')
WHEN NOT MATCHED THEN
  INSERT (ActorId, InstanceId, Status, Note, SubmittedAt)
  VALUES (@actorId, @instanceId, 'Submitted', @note, SYSUTCDATETIME());";
        await using var c = Open();
        await c.ExecuteAsync(sql, new { actorId, instanceId, note });
    }

    public async Task<bool> DeleteActorAvailabilityAsync(int actorId, int instanceId)
    {
        await using var c = Open();
        return await c.ExecuteAsync(
            "DELETE FROM dbo.ActorAvailability WHERE ActorId=@actorId AND InstanceId=@instanceId;",
            new { actorId, instanceId }) > 0;
    }

    // ── Actor Assignments ─────────────────────────────────────────────────────

    public async Task<List<ActorAssignmentDto>> GetActorAssignmentsForInstanceAsync(int instanceId)
    {
        const string sql = @"
SELECT
  asgn.AssignmentId, asgn.InstanceId, asgn.ActorId,
  a.FullName AS ActorName, a.Gender, a.AgeGroup,
  asgn.DecisionNote, asgn.AssignedAt
FROM dbo.ActorAssignments asgn
JOIN dbo.Actors a ON a.ActorId = asgn.ActorId
WHERE asgn.InstanceId = @instanceId
ORDER BY a.FullName;";
        await using var c = Open();
        return (await c.QueryAsync<ActorAssignmentDto>(sql, new { instanceId })).AsList();
    }

    public async Task<int> AssignActorAsync(int instanceId, int actorId, string? decisionNote)
    {
        const string sql = @"
IF NOT EXISTS (SELECT 1 FROM dbo.ActorAssignments WHERE InstanceId=@instanceId AND ActorId=@actorId)
BEGIN
  INSERT INTO dbo.ActorAssignments (InstanceId, ActorId, DecisionNote, AssignedAt)
  VALUES (@instanceId, @actorId, @decisionNote, SYSUTCDATETIME());
END
SELECT ISNULL((SELECT TOP 1 AssignmentId FROM dbo.ActorAssignments WHERE InstanceId=@instanceId AND ActorId=@actorId), 0);";
        await using var c = Open();
        return await c.ExecuteScalarAsync<int>(sql, new { instanceId, actorId, decisionNote });
    }

    public async Task<bool> RemoveActorAssignmentAsync(int instanceId, int actorId)
    {
        await using var c = Open();
        return await c.ExecuteAsync(
            "DELETE FROM dbo.ActorAssignments WHERE InstanceId=@instanceId AND ActorId=@actorId;",
            new { instanceId, actorId }) > 0;
    }

    // ── Upcoming instances for actor availability page ────────────────────────

    public async Task<List<UpcomingInstanceDto>> GetUpcomingInstancesAsync()
    {
        const string sql = @"
SELECT
  inst.InstanceId, a.ActivityId, a.ActivityName,
  c.CourseName, t.TypeName,
  inst.StartUtc, inst.EndUtc
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
JOIN dbo.Courses    c ON c.CourseId   = a.CourseId
JOIN dbo.ActivityTypes t ON t.ActivityTypeId = a.ActivityTypeId
WHERE inst.StartUtc >= SYSUTCDATETIME()
  AND ISNULL(inst.IsCancelled, 0) = 0
ORDER BY inst.StartUtc;";
        await using var c = Open();
        return (await c.QueryAsync<UpcomingInstanceDto>(sql)).AsList();
    }
}
