using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Lead assignment: details, eligibility, availability, fairness and approvals.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Returns activity details and its instances for a lead (optionally enforcing that caller is the lead).
    /// </summary>
    public async Task<LeadActivityDetailsDto?> GetLeadActivityDetailsAsync(int activityId, int? mustBeLeadInstructorId)
    {
        const string sqlActivity = @"
SELECT TOP 1
  a.ActivityId,
  a.ActivityName,
  a.ActivityTypeId,
  a.CourseId,
  a.LeadInstructorId,
  a.ApplicationDeadlineUtc
FROM dbo.Activities a
WHERE a.ActivityId = @activityId
  AND (@leadId IS NULL OR a.LeadInstructorId = @leadId);";

        const string sqlInstances = @"
SELECT
  inst.InstanceId,
  inst.StartUtc,
  inst.EndUtc,
  ISNULL(inst.RoomsCount,0) AS RoomsCount,
  ISNULL(inst.RequiredInstructors,0) AS RequiredInstructors
FROM dbo.ActivityInstances inst
WHERE inst.ActivityId = @activityId
ORDER BY inst.StartUtc;";

        await using var c = Open();
        var a = await c.QueryFirstOrDefaultAsync<LeadActivityDetailsDto>(sqlActivity, new { activityId, leadId = mustBeLeadInstructorId });
        if (a == null) return null;

        a.Instances = (await c.QueryAsync<ActivityInstanceWithIdDto>(sqlInstances, new { activityId })).AsList();
        return a;
    }

    /// <summary>
    /// Returns instructors eligible for the activity (based on course certifications),
    /// optionally enforcing that caller is the lead.
    /// </summary>
    public async Task<IEnumerable<InstructorDto>> GetEligibleInstructorsForLeadActivityAsync(int activityId, int? mustBeLeadInstructorId)
    {
        const string sql = @"
SELECT i.InstructorId, i.FullName, i.Email
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
WHERE ic.CourseId = (
    SELECT TOP 1 a.CourseId
    FROM dbo.Activities a
    WHERE a.ActivityId = @activityId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
)
ORDER BY i.FullName;";

        await using var c = Open();
        return await c.QueryAsync<InstructorDto>(sql, new { activityId, leadId = mustBeLeadInstructorId });
    }

    /// <summary>
    /// Returns availability request rows for an instance (with isAssigned flag),
    /// optionally enforcing that caller is the lead of the activity.
    /// </summary>
    public async Task<IEnumerable<LeadInstanceAvailabilityDto>> GetLeadInstanceAvailabilityAsync(int instanceId, int? mustBeLeadInstructorId)
    {
        const string sql = @"
;WITH Guard AS (
    SELECT TOP 1 a.ActivityId
    FROM dbo.ActivityInstances inst
    JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE inst.InstanceId = @instanceId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
)
SELECT
  ar.AvailabilityId,
  ar.InstanceId,
  ar.InstructorId,
  i.FullName,
  i.Email,
  ar.Status,
  ar.SubmittedAtUtc,
  ar.DecisionAtUtc,
  ar.DecisionByInstructorId,
  ar.DecisionNote,
  CASE WHEN EXISTS (
      SELECT 1 FROM dbo.Assignments ass
      WHERE ass.InstanceId = ar.InstanceId
        AND ass.InstructorId = ar.InstructorId
        AND ass.Status = 'Approved'
        AND ass.CancelledAtUtc IS NULL
  ) THEN 1 ELSE 0 END AS IsAssigned
FROM dbo.AvailabilityRequests ar
JOIN dbo.Instructors i ON i.InstructorId = ar.InstructorId
WHERE ar.InstanceId = @instanceId
  AND EXISTS (SELECT 1 FROM Guard)
ORDER BY i.FullName;";

        await using var c = Open();
        return await c.QueryAsync<LeadInstanceAvailabilityDto>(sql, new { instanceId, leadId = mustBeLeadInstructorId });
    }

    /// <summary>
    /// Returns fairness rows ("approved assignments in month") for eligible instructors for a given instance,
    /// optionally enforcing that caller is the lead.
    /// </summary>
    public async Task<IEnumerable<FairnessRowDto>> GetFairnessForInstanceAsync(int instanceId, int? mustBeLeadInstructorId)
    {
        const string sql = @"
;WITH Guard AS (
    SELECT TOP 1 a.ActivityId, a.CourseId, inst.StartUtc
    FROM dbo.ActivityInstances inst
    JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE inst.InstanceId = @instanceId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
),
Bounds AS (
    SELECT
      CourseId,
      DATEFROMPARTS(YEAR(StartUtc), MONTH(StartUtc), 1) AS M1,
      DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(StartUtc), MONTH(StartUtc), 1)) AS M2
    FROM Guard
)
SELECT
  i.InstructorId,
  i.FullName,
  i.Email,
  (
    SELECT COUNT(1)
    FROM dbo.Assignments ass
    WHERE ass.InstructorId = i.InstructorId
      AND ass.Status = 'Approved'
      AND ass.CancelledAtUtc IS NULL
      AND ass.AssignedAtUtc >= b.M1
      AND ass.AssignedAtUtc <  b.M2
  ) AS ApprovedInMonth
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
JOIN Bounds b ON b.CourseId = ic.CourseId
WHERE EXISTS (SELECT 1 FROM Guard)
ORDER BY ApprovedInMonth, i.FullName;";

        await using var c = Open();
        return await c.QueryAsync<FairnessRowDto>(sql, new { instanceId, leadId = mustBeLeadInstructorId });
    }

    /// <summary>
    /// Returns a compact fairness list (eligible instructors + count of approved assignments this month).
    /// Note: this is the "table צדק" variant without lead-guard.
    /// </summary>
    public async Task<List<InstanceFairnessDto>> GetFairnessForInstanceAsync(int instanceId)
    {
        const string sql = @"
WITH Eligible AS (
    SELECT ic.InstructorId
    FROM InstructorCourses ic
    JOIN ActivityInstances ai ON ai.InstanceId = @instanceId
    JOIN Activities a ON a.ActivityId = ai.ActivityId
    WHERE ic.CourseId = a.CourseId
),
MonthlyApproved AS (
    SELECT ass.InstructorId, COUNT(*) AS ApprovedCount
    FROM Assignments ass
    JOIN ActivityInstances ai2 ON ai2.InstanceId = ass.InstanceId
    WHERE ass.Status = 'Approved'
      AND ass.CancelledAtUtc IS NULL
      AND ai2.StartUtc >= DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)
    GROUP BY ass.InstructorId
)
SELECT 
    e.InstructorId,
    ISNULL(m.ApprovedCount, 0) AS ApprovedCount
FROM Eligible e
LEFT JOIN MonthlyApproved m ON m.InstructorId = e.InstructorId
ORDER BY ISNULL(m.ApprovedCount, 0);";

        await using var c = Open();
        var rows = await c.QueryAsync<InstanceFairnessDto>(sql, new { instanceId });
        return rows.ToList();
    }

    /// <summary>
    /// Approves assignments for a given instance for selected instructors.
    /// Enforces lead permissions unless admin.
    /// Also upserts AvailabilityRequests rows to "Approved".
    /// </summary>
    public async Task<(bool Ok, string? Error)> ApproveLeadAssignmentsAsync(
        int instanceId,
        List<int> instructorIds,
        int actorInstructorId,
        bool isAdmin,
        string? note)
    {
        const string sqlGuard = @"
SELECT TOP 1 a.LeadInstructorId, inst.RequiredInstructors
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
WHERE inst.InstanceId = @instanceId;";

        await using var c = Open();
        var g = await c.QueryFirstOrDefaultAsync<(int? LeadInstructorId, int RequiredInstructors)>(sqlGuard, new { instanceId });
        if (g.RequiredInstructors <= 0) return (false, "Instance not found");

        if (!isAdmin && g.LeadInstructorId != actorInstructorId)
            return (false, "Forbidden: not lead of this activity");

        if (instructorIds.Count > g.RequiredInstructors)
            return (false, $"Too many instructors. Required={g.RequiredInstructors}");

        const string sqlUpsertAssign = @"
IF EXISTS (SELECT 1 FROM dbo.Assignments WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId AND CancelledAtUtc IS NULL)
BEGIN
  UPDATE dbo.Assignments
  SET Status='Approved', AssignedAtUtc=SYSUTCDATETIME(), AssignedByInstructorId=@ById
  WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId AND CancelledAtUtc IS NULL;
END
ELSE
BEGIN
  INSERT INTO dbo.Assignments (InstanceId, InstructorId, AssignedAtUtc, AssignedByInstructorId, Status)
  VALUES (@InstanceId, @InstructorId, SYSUTCDATETIME(), @ById, 'Approved');
END";

        const string sqlUpsertAvail = @"
IF EXISTS (SELECT 1 FROM dbo.AvailabilityRequests WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId)
BEGIN
  UPDATE dbo.AvailabilityRequests
  SET Status='Approved',
      DecisionAtUtc=SYSUTCDATETIME(),
      DecisionByInstructorId=@ById,
      DecisionNote=@Note
  WHERE InstanceId=@InstanceId AND InstructorId=@InstructorId;
END
ELSE
BEGIN
  INSERT INTO dbo.AvailabilityRequests
  (InstanceId, InstructorId, Status, SubmittedAtUtc, DecisionAtUtc, DecisionByInstructorId, DecisionNote)
  VALUES
  (@InstanceId, @InstructorId, 'Approved', SYSUTCDATETIME(), SYSUTCDATETIME(), @ById, @Note);
END";

        using var tx = c.BeginTransaction();
        try
        {
            foreach (var insId in instructorIds.Distinct())
            {
                await c.ExecuteAsync(sqlUpsertAssign, new { InstanceId = instanceId, InstructorId = insId, ById = actorInstructorId }, tx);
                await c.ExecuteAsync(sqlUpsertAvail, new { InstanceId = instanceId, InstructorId = insId, ById = actorInstructorId, Note = note }, tx);
            }

            tx.Commit();
            return (true, null);
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return (false, "DB error: " + ex.Message);
        }
    }

    /// <summary>
    /// Builds (does not send) availability reminder emails to eligible instructors for an instance.
    /// It enforces lead permissions unless admin and can optionally skip instructors who already responded.
    /// </summary>
    public async Task<(bool Ok, string? Error, List<EmailPayload> Emails)> BuildLeadAvailabilityReminderEmailsAsync(
        int instanceId,
        int actorInstructorId,
        bool isAdmin,
        bool onlyNotResponded,
        IConfiguration cfg)
    {
        const string sqlHeader = @"
SELECT TOP 1
  a.ActivityId,
  a.ActivityName,
  a.CourseId,
  c.CourseName,
  a.LeadInstructorId,
  inst.StartUtc,
  inst.EndUtc
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
LEFT JOIN dbo.Courses c ON c.CourseId = a.CourseId
WHERE inst.InstanceId = @instanceId;";

        const string sqlEligible = @"
SELECT i.InstructorId, i.Email
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
JOIN dbo.ActivityInstances inst ON inst.InstanceId = @instanceId
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
WHERE ic.CourseId = a.CourseId
  AND i.Status = 'Active';";

        const string sqlResponded = @"
SELECT InstructorId
FROM dbo.AvailabilityRequests
WHERE InstanceId = @instanceId;";

        await using var c = Open();

        var h = await c.QueryFirstOrDefaultAsync(sqlHeader, new { instanceId });
        if (h == null) return (false, "Instance not found", new List<EmailPayload>());

        int leadId = (int)(h.LeadInstructorId ?? 0);
        if (!isAdmin && leadId != actorInstructorId)
            return (false, "Forbidden: not lead of this activity", new List<EmailPayload>());

        var eligible = (await c.QueryAsync(sqlEligible, new { instanceId })).ToList();

        HashSet<int> responded = new();
        if (onlyNotResponded)
            responded = (await c.QueryAsync<int>(sqlResponded, new { instanceId })).ToHashSet();

        string fmtIL(DateTime utc)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
                var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
                return local.ToString("dd/MM/yyyy HH:mm");
            }
            catch { return utc.ToString("dd/MM/yyyy HH:mm") + " UTC"; }
        }

        var startUtc = (DateTime)h.StartUtc;
        var endUtc = (DateTime)h.EndUtc;

        var baseUrl = cfg["App:BaseUrl"] ?? "";
        var link = string.IsNullOrWhiteSpace(baseUrl) ? "" : $"{baseUrl.TrimEnd('/')}/availability.html?instanceId={instanceId}";

        var emails = new List<EmailPayload>();

        foreach (var ins in eligible)
        {
            int instructorId = (int)ins.InstructorId;
            string email = (string)ins.Email;

            if (string.IsNullOrWhiteSpace(email)) continue;
            if (onlyNotResponded && responded.Contains(instructorId)) continue;

            var subject = $"בקשת זמינות: {h.ActivityName} ({fmtIL(startUtc)})";
            var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h2>בקשת זמינות למופע</h2>
  <div><b>פעילות:</b> {h.ActivityName}</div>
  <div><b>קורס:</b> {h.CourseName}</div>
  <div><b>מועד:</b> {fmtIL(startUtc)} – {fmtIL(endUtc)}</div>
  <hr/>
  <p>נא להיכנס ולהציע זמינות.</p>
  {(string.IsNullOrWhiteSpace(link) ? "" : $@"<p><a href=""{link}"">לחץ/י כאן להגשת זמינות</a></p>")}
  <div style=""color:#6b7280;font-size:12px"">InstanceId: {instanceId}</div>
</div>";

            emails.Add(new EmailPayload(
                ToEmail: email,
                Subject: subject,
                BodyHtml: body,
                RelatedEntity: "AvailabilityReminder",
                RelatedId: instanceId.ToString()
            ));
        }

        return (true, null, emails);
    }
}
