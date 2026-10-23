using Dapper;

/// <summary>
/// DB access for the automatic reminder background service.
/// Finds upcoming instances and tracks what has already been sent.
/// </summary>
public sealed partial class Db
{
    // ── Read: pending reminders ───────────────────────────────────────────────

    /// <summary>
    /// Returns lead instructors whose instances start in a window around
    /// (now + daysBefore days) and have NOT yet received an Email reminder.
    /// </summary>
    public async Task<List<ReminderDueDto>> GetPendingEmailRemindersAsync(int daysBefore)
    {
        int hoursLow  = daysBefore * 24 - 1;
        int hoursHigh = daysBefore * 24 + 1;

        const string sql = @"
SELECT
    ai.InstanceId,
    a.ActivityName,
    ai.StartUtc,
    ai.EndUtc,
    ISNULL(ai.Location, '') AS Location,
    i.InstructorId,
    ISNULL(i.FullName, i.Email) AS FullName,
    i.Email,
    i.Phone
FROM dbo.ActivityInstances ai
JOIN dbo.Activities   a ON a.ActivityId   = ai.ActivityId
JOIN dbo.Instructors  i ON i.InstructorId = a.LeadInstructorId
WHERE ai.IsCancelled  = 0
  AND a.IsCancelled   = 0
  AND i.Email IS NOT NULL
  AND ai.StartUtc >= DATEADD(HOUR, @hoursLow,  SYSUTCDATETIME())
  AND ai.StartUtc <  DATEADD(HOUR, @hoursHigh, SYSUTCDATETIME())
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ReminderLog rl
      WHERE rl.InstanceId   = ai.InstanceId
        AND rl.InstructorId = i.InstructorId
        AND rl.DaysBefore   = @daysBefore
        AND rl.Channel      = 'Email'
  );";

        await using var c = Open();
        return (await c.QueryAsync<ReminderDueDto>(
            sql, new { hoursLow, hoursHigh, daysBefore })).ToList();
    }

    /// <summary>
    /// Returns lead instructors (with phone) whose instances start in the
    /// reminder window and have NOT yet received a WhatsApp reminder.
    /// </summary>
    public async Task<List<ReminderDueDto>> GetPendingWhatsAppRemindersAsync(int daysBefore)
    {
        int hoursLow  = daysBefore * 24 - 1;
        int hoursHigh = daysBefore * 24 + 1;

        const string sql = @"
SELECT
    ai.InstanceId,
    a.ActivityName,
    ai.StartUtc,
    ai.EndUtc,
    ISNULL(ai.Location, '') AS Location,
    i.InstructorId,
    ISNULL(i.FullName, i.Email) AS FullName,
    i.Email,
    i.Phone
FROM dbo.ActivityInstances ai
JOIN dbo.Activities   a ON a.ActivityId   = ai.ActivityId
JOIN dbo.Instructors  i ON i.InstructorId = a.LeadInstructorId
WHERE ai.IsCancelled  = 0
  AND a.IsCancelled   = 0
  AND i.Phone IS NOT NULL
  AND ai.StartUtc >= DATEADD(HOUR, @hoursLow,  SYSUTCDATETIME())
  AND ai.StartUtc <  DATEADD(HOUR, @hoursHigh, SYSUTCDATETIME())
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ReminderLog rl
      WHERE rl.InstanceId   = ai.InstanceId
        AND rl.InstructorId = i.InstructorId
        AND rl.DaysBefore   = @daysBefore
        AND rl.Channel      = 'WhatsApp'
  );";

        await using var c = Open();
        return (await c.QueryAsync<ReminderDueDto>(
            sql, new { hoursLow, hoursHigh, daysBefore })).ToList();
    }

    // ── Write: log a sent reminder ────────────────────────────────────────────

    public async Task LogReminderAsync(
        int instanceId, int instructorId, int daysBefore,
        string channel, string status, string? failReason = null)
    {
        const string sql = @"
-- INSERT only if no row exists yet (concurrent protection)
IF NOT EXISTS (
    SELECT 1 FROM dbo.ReminderLog
    WHERE InstanceId=@instanceId AND InstructorId=@instructorId
      AND DaysBefore=@daysBefore AND Channel=@channel)
INSERT INTO dbo.ReminderLog
    (InstanceId, InstructorId, DaysBefore, Channel, SentAt, Status, FailReason)
VALUES
    (@instanceId, @instructorId, @daysBefore, @channel,
     SYSUTCDATETIME(), @status, @failReason);";

        await using var c = Open();
        await c.ExecuteAsync(sql,
            new { instanceId, instructorId, daysBefore, channel, status, failReason });
    }

    // ── SysAdmin: view reminder log ───────────────────────────────────────────

    public async Task<List<ReminderLogRowDto>> GetReminderLogAsync(int days)
    {
        const string sql = @"
SELECT TOP 500
    rl.LogId,
    rl.InstanceId,
    a.ActivityName,
    ai.StartUtc,
    rl.InstructorId,
    ISNULL(i.FullName, i.Email) AS InstructorName,
    rl.DaysBefore,
    rl.Channel,
    rl.Status,
    rl.FailReason,
    rl.SentAt
FROM dbo.ReminderLog rl
JOIN dbo.ActivityInstances ai ON ai.InstanceId   = rl.InstanceId
JOIN dbo.Activities        a  ON a.ActivityId    = ai.ActivityId
JOIN dbo.Instructors       i  ON i.InstructorId  = rl.InstructorId
WHERE rl.SentAt >= DATEADD(DAY, -@days, SYSUTCDATETIME())
ORDER BY rl.LogId DESC;";

        await using var c = Open();
        return (await c.QueryAsync<ReminderLogRowDto>(sql, new { days })).ToList();
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public class ReminderDueDto
{
    public int      InstanceId   { get; set; }
    public string   ActivityName { get; set; } = "";
    public DateTime StartUtc     { get; set; }
    public DateTime EndUtc       { get; set; }
    public string   Location     { get; set; } = "";
    public int      InstructorId { get; set; }
    public string   FullName     { get; set; } = "";
    public string   Email        { get; set; } = "";
    public string?  Phone        { get; set; }
}

public class ReminderLogRowDto
{
    public long     LogId          { get; set; }
    public int      InstanceId     { get; set; }
    public string   ActivityName   { get; set; } = "";
    public DateTime StartUtc       { get; set; }
    public int      InstructorId   { get; set; }
    public string   InstructorName { get; set; } = "";
    public int      DaysBefore     { get; set; }
    public string   Channel        { get; set; } = "";
    public string   Status         { get; set; } = "";
    public string?  FailReason     { get; set; }
    public DateTime SentAt         { get; set; }
}
