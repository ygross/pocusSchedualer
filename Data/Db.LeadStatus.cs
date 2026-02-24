using Dapper;
using PocusSchedualer.Api.Dtos;

/// <summary>
/// LeadsStatus (CourseManager/Admin) consolidated queries.
/// NOTE: The DB schema is snapshot in Database.json (InstanceId PK in ActivityInstances, Assignments, AvailabilityRequests).
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Returns courses that have at least one activity with a LeadInstructorId matching the lead.
    /// This is used to build the course dropdown for the lead.
    /// </summary>
    public async Task<List<LeadCourseDto>> GetCoursesForLeadAsync(int leadInstructorId)
    {
        const string sql = @"
SELECT
    c.CourseId,
    c.CourseName,
    c.ActivityTypeId,
    COUNT(DISTINCT a.ActivityId) AS ActivitiesCount
FROM dbo.Courses c
JOIN dbo.Activities a ON a.CourseId = c.CourseId
WHERE
    a.CourseId IS NOT NULL
    AND a.LeadInstructorId = @leadInstructorId
    AND a.IsCancelled = 0
GROUP BY c.CourseId, c.CourseName, c.ActivityTypeId
ORDER BY c.CourseName;";

        await using var c = Open();
        return (await c.QueryAsync<LeadCourseDto>(sql, new { leadInstructorId })).AsList();
    }

    /// <summary>
    /// Returns instance rows for a given course and time range.
    /// If mustBeLeadInstructorId is supplied - enforces that the course has at least one activity led by that instructor.
    /// </summary>
    public async Task<List<LeadStatusInstanceRowDto>> GetLeadCourseInstancesStatusAsync(
        int courseId,
        DateTime fromUtc,
        DateTime toUtc,
        int? mustBeLeadInstructorId)
    {
        const string sql = @"
;WITH Guard AS (
    SELECT TOP 1 1 AS Ok
    FROM dbo.Activities a
    WHERE a.CourseId = @courseId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
)
SELECT
    inst.InstanceId,
    inst.ActivityId,
    a.ActivityName,
    inst.StartUtc,
    inst.EndUtc,
    inst.RequiredInstructors,
    (
        SELECT COUNT(1)
        FROM dbo.Assignments ass
        WHERE ass.InstanceId = inst.InstanceId
          AND ass.Status = 'Approved'
          AND ass.CancelledAtUtc IS NULL
    ) AS AssignedCount,
    CAST(inst.IsCancelled AS bit) AS IsCancelled,
    inst.CancelReason
FROM dbo.ActivityInstances inst
JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
WHERE
    inst.StartUtc >= @fromUtc
    AND inst.StartUtc <  @toUtc
    AND a.CourseId = @courseId
    AND EXISTS (SELECT 1 FROM Guard)
ORDER BY inst.StartUtc;";

        await using var c = Open();
        return (await c.QueryAsync<LeadStatusInstanceRowDto>(sql, new
        {
            courseId,
            fromUtc,
            toUtc,
            leadId = mustBeLeadInstructorId
        })).AsList();
    }

    /// <summary>
    /// Returns grouped EmailOutbox rows (sent/queued/failed) related to instances under the course for the range.
    /// Grouping key: RelatedEntity + RelatedId + Subject + Day(CreatedAtUtc).
    /// Filters out OTP-like mails.
    /// </summary>
    public async Task<List<LeadStatusMessageGroupDto>> GetLeadCourseMessagesGroupedAsync(
        int courseId,
        DateTime fromUtc,
        DateTime toUtc,
        int? mustBeLeadInstructorId,
        bool includeBodyHtml)
    {
        var sql = @"
;WITH Guard AS (
    SELECT TOP 1 1 AS Ok
    FROM dbo.Activities a
    WHERE a.CourseId = @courseId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
), InstanceIds AS (
    SELECT inst.InstanceId
    FROM dbo.ActivityInstances inst
    JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE inst.StartUtc >= @fromUtc
      AND inst.StartUtc <  @toUtc
      AND a.CourseId = @courseId
      AND EXISTS (SELECT 1 FROM Guard)
)
SELECT
    ISNULL(eo.RelatedEntity, 'Unknown') AS RelatedEntity,
    ISNULL(eo.RelatedId, '')           AS RelatedId,
    CAST(eo.CreatedAtUtc AS date)      AS DayUtc,
    ISNULL(eo.Subject, '')             AS Subject,
    CASE
        WHEN SUM(CASE WHEN eo.Status = 'Failed' THEN 1 ELSE 0 END) > 0 THEN 'Failed'
        WHEN SUM(CASE WHEN eo.Status = 'Queued' THEN 1 ELSE 0 END) > 0 THEN 'Queued'
        WHEN SUM(CASE WHEN eo.Status = 'Sent'   THEN 1 ELSE 0 END) > 0 THEN 'Sent'
        ELSE 'Unknown'
    END AS AggregateStatus,
    COUNT(1) AS RecipientsCount,
    MIN(eo.CreatedAtUtc) AS FirstCreatedAtUtc,
    MAX(eo.CreatedAtUtc) AS LastCreatedAtUtc,
    MAX(eo.SentAtUtc)    AS LastSentAtUtc,
    SUM(CASE WHEN eo.Status = 'Failed' THEN 1 ELSE 0 END) AS FailedCount,
    SUM(CASE WHEN eo.Status = 'Sent'   THEN 1 ELSE 0 END) AS SentCount,
    SUM(CASE WHEN eo.Status = 'Queued' THEN 1 ELSE 0 END) AS QueuedCount,
    " + (includeBodyHtml ? "MIN(eo.BodyHtml)" : "CAST(NULL AS nvarchar(max))") + @" AS AnyBodyHtml
FROM dbo.EmailOutbox eo
JOIN InstanceIds iids
  ON TRY_CONVERT(int, eo.RelatedId) = iids.InstanceId
WHERE
    eo.CreatedAtUtc >= @fromUtc
    AND eo.CreatedAtUtc <  @toUtc
    AND (eo.RelatedEntity IS NULL OR eo.RelatedEntity NOT IN ('Otp','OtpCodes','OtpCode','AuthOtp'))
    AND (eo.Subject IS NULL
         OR (eo.Subject NOT LIKE '%OTP%'
             AND eo.Subject NOT LIKE '%קוד%'
             AND eo.Subject NOT LIKE '%חד פעמי%'))
GROUP BY
    eo.RelatedEntity,
    eo.RelatedId,
    CAST(eo.CreatedAtUtc AS date),
    eo.Subject
ORDER BY DayUtc DESC, Subject;";

        await using var c = Open();
        return (await c.QueryAsync<LeadStatusMessageGroupDto>(sql, new
        {
            courseId,
            fromUtc,
            toUtc,
            leadId = mustBeLeadInstructorId
        })).AsList();
    }

    /// <summary>
    /// Returns "fairness" rows for instructors certified for this course:
    /// approved assignments count (for instances in range), availability submissions, and outreach email count.
    /// </summary>
    public async Task<List<LeadStatusFairnessRowDto>> GetLeadCourseFairnessAsync(
        int courseId,
        DateTime fromUtc,
        DateTime toUtc,
        int? mustBeLeadInstructorId)
    {
        const string sql = @"
;WITH Guard AS (
    SELECT TOP 1 1 AS Ok
    FROM dbo.Activities a
    WHERE a.CourseId = @courseId
      AND (@leadId IS NULL OR a.LeadInstructorId = @leadId)
), CourseInstances AS (
    SELECT inst.InstanceId
    FROM dbo.ActivityInstances inst
    JOIN dbo.Activities a ON a.ActivityId = inst.ActivityId
    WHERE inst.StartUtc >= @fromUtc
      AND inst.StartUtc <  @toUtc
      AND a.CourseId = @courseId
      AND EXISTS (SELECT 1 FROM Guard)
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
          AND ass.InstanceId IN (SELECT InstanceId FROM CourseInstances)
    ) AS AssignedApproved,
    (
        SELECT COUNT(1)
        FROM dbo.AvailabilityRequests ar
        WHERE ar.InstructorId = i.InstructorId
          AND ar.InstanceId IN (SELECT InstanceId FROM CourseInstances)
    ) AS AvailabilitySubmitted,
    (
        SELECT COUNT(1)
        FROM dbo.EmailOutbox eo
        WHERE LOWER(eo.ToEmail) = LOWER(i.Email)
          AND TRY_CONVERT(int, eo.RelatedId) IN (SELECT InstanceId FROM CourseInstances)
          AND (eo.RelatedEntity IS NULL OR eo.RelatedEntity NOT IN ('Otp','OtpCodes','OtpCode','AuthOtp'))
          AND (eo.Subject IS NULL
               OR (eo.Subject NOT LIKE '%OTP%'
                   AND eo.Subject NOT LIKE '%קוד%'
                   AND eo.Subject NOT LIKE '%חד פעמי%'))
    ) AS OutreachEmails
FROM dbo.Instructors i
JOIN dbo.InstructorCourses ic ON ic.InstructorId = i.InstructorId
WHERE
    ic.CourseId = @courseId
    AND EXISTS (SELECT 1 FROM Guard)
ORDER BY i.FullName;";

        await using var c = Open();
        var rows = (await c.QueryAsync(sql, new { courseId, fromUtc, toUtc, leadId = mustBeLeadInstructorId })).ToList();

        var list = new List<LeadStatusFairnessRowDto>(rows.Count);
        foreach (var r in rows)
        {
            int outreach = (int)r.OutreachEmails;
            int submitted = (int)r.AvailabilitySubmitted;
            int notResponded = Math.Max(0, outreach - submitted);

            list.Add(new LeadStatusFairnessRowDto(
                InstructorId: (int)r.InstructorId,
                FullName: (string)r.FullName,
                Email: (string?)r.Email,
                AssignedApproved: (int)r.AssignedApproved,
                AvailabilitySubmitted: submitted,
                OutreachEmails: outreach,
                NotRespondedEstimate: notResponded
            ));
        }

        return list;
    }
}
