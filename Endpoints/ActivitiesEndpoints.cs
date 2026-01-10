using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

public static class ActivitiesEndpoints
{
    public static void MapActivitiesEndpoints(this WebApplication app)
    {
        // =======================
        // Activities - Create
        // =======================
        app.MapPost("/api/activities/create", async (
            HttpContext ctx,
            ActivityCreateDto dto,
            Db db,
            IConfiguration cfg,
            EmailService emailSvc) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.ActivityName))
                    return Results.BadRequest("ActivityName is required");
                if (dto.ActivityTypeId <= 0)
                    return Results.BadRequest("ActivityTypeId is required");
                if (dto.CourseId <= 0)
                    return Results.BadRequest("CourseId is required");
                if (dto.LeadInstructorId <= 0)
                    return Results.BadRequest("LeadInstructorId is required");
                if (dto.Instances == null || dto.Instances.Count == 0)
                    return Results.BadRequest("At least one instance is required");

                var activityId = await db.CreateActivityAsync(dto);

                // שולחים מייל למדריך המרכז (Lead) על פעילות + רשימת מופעים
                var header = await db.GetActivityEmailHeaderAsync(activityId);
                if (header != null && !string.IsNullOrWhiteSpace(header.LeadInstructorEmail))
                {
                    var instances = (await db.GetActivityInstancesForEmailAsync(activityId)).ToList();

                    static string FormatIL(DateTime utc)
                    {
                        try
                        {
                            var tz = TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time");
                            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
                            return local.ToString("dd/MM/yyyy HH:mm");
                        }
                        catch
                        {
                            return utc.ToString("dd/MM/yyyy HH:mm") + " UTC";
                        }
                    }

                    var rows = string.Join("", instances.Select((x, idx) => $@"
<tr>
  <td>{idx + 1}</td>
  <td>{FormatIL(x.StartUtc)}</td>
  <td>{FormatIL(x.EndUtc)}</td>
  <td>{(x.RoomsCount?.ToString() ?? "-")}</td>
  <td>{x.RequiredInstructors}</td>
  <td>{x.InstanceId}</td>
</tr>"));

                    var subject = $"📌 פעילות חדשה נשמרה: {header.ActivityName}";
                    var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h2>נוצרה פעילות חדשה במערכת</h2>

  <div><b>שם פעילות:</b> {header.ActivityName}</div>
  <div><b>סוג פעילות:</b> {header.TypeName}</div>
  <div><b>קורס:</b> {(header.CourseName ?? "-")}</div>
  <div><b>מדריך מרכז:</b> {(header.LeadInstructorName ?? "-")}</div>
  <div><b>דדליין הרשמה:</b> {(header.ApplicationDeadlineUtc.HasValue ? header.ApplicationDeadlineUtc.Value.ToString("dd/MM/yyyy HH:mm") : "-")}</div>

  <hr/>
  <h3>מופעים שנוצרו</h3>
  <table style=""width:100%;border-collapse:collapse"" border=""1"" cellpadding=""6"">
    <thead style=""background:#f3f4f6"">
      <tr>
        <th>#</th>
        <th>התחלה</th>
        <th>סיום</th>
        <th>חדרים</th>
        <th>מדריכים נדרשים</th>
        <th>InstanceId</th>
      </tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>

  <p style=""margin-top:12px;color:#6b7280"">
    ActivityId: {header.ActivityId}
  </p>
</div>";

                    // תמיד לשמור באאוטבוקס
                    var emailId = await emailSvc.QueueAsync(
                        header.LeadInstructorEmail,
                        subject,
                        body,
                        relatedEntity: "Activities",
                        relatedId: activityId.ToString()
                    );

                    // ניסיון שליחה מיידי (אם נכשל - נשאר באאוטבוקס)
                    await emailSvc.TrySendQueuedNowAsync(
                        ctx,
                        emailId,
                        header.LeadInstructorEmail,
                        subject,
                        body,
                        relatedEntity: "Activities",
                        relatedId: activityId.ToString(),
                        actorInstructorId: null,
                        attemptNo: 1
                    );
                }

                return Results.Ok(new { status = "Created", activityId, instances = dto.Instances.Count });
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message);
            }
        });
    }
}
