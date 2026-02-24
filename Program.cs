using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

using PocusSchedualer.Services;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// שירות ה-DB
builder.Services.AddSingleton<Db>();
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "SimPocusAuth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.None;
        options.Cookie.SameSite = SameSiteMode.Lax;
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireRole(Roles.Admin));
    options.AddPolicy("CourseManagerOnly", p => p.RequireRole(Roles.CourseManager));
    options.AddPolicy("InstructorOnly", p => p.RequireRole(Roles.Instructor));

    // למי שמותר להיכנס בכלל (כל אחד מהתפקידים)
    options.AddPolicy("AnyUser", p => p.RequireRole(Roles.Admin, Roles.CourseManager, Roles.Instructor));
});

builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<EmailService>();

// Persist data-protection keys so auth cookies remain valid across app restarts / redeployments.
// Keys are stored in "dp-keys" folder NEXT TO (not inside) the publish directory,
// so they survive "dotnet publish" overwriting the api\ folder.
{
    var publishDir = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
    var keysPath = System.IO.Path.Combine(
        publishDir.Parent?.FullName ?? publishDir.FullName,
        "dp-keys");
    System.IO.Directory.CreateDirectory(keysPath);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new System.IO.DirectoryInfo(keysPath))
        .SetApplicationName("PocusSchedualer");
}

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapAuthEndpoints();
app.MapAvailabilityEndpoints();

/*
app.MapGet("/api/health/db", async (Db db) =>
{
    var ok = await db.IsDbAliveAsync();
    return Results.Ok(new { ok });
});
*/

// =======================
// LEAD API (סט ראשון בלבד)
// =======================

app.MapGet("/api/lead/activities", async (
    HttpContext ctx,
    int? activityTypeId,
    int? take,
    int? leadInstructorId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    int? effectiveLead = isAdmin ? leadInstructorId : myId;

    var rows = await db.SearchActivitiesAsync(
        activityId: null,
        nameContains: null,
        activityTypeId: activityTypeId,
        leadInstructorId: effectiveLead,
        take: take ?? 200
    );

    return Results.Ok(rows);
});

app.MapGet("/api/lead/instances/{instanceId:int}/fairness", async (
    HttpContext ctx,
    int instanceId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    // Admins see all; non-admin leads are guard-checked inside the DB method
    var rows = await db.GetFairnessForInstanceAsync(instanceId, isAdmin ? null : myId);
    return Results.Ok(rows);
});


app.MapDelete("/api/api/activity-instances/{instanceId:int}", async (
    HttpContext ctx,
    int instanceId,
    [FromBody] DeleteInstanceReq? body,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin || myId == null) return Results.Forbid();

    var result = await db.SoftDeleteInstanceAsync(instanceId, myId.Value, body?.Reason);

    if (result.Ok) return Results.Ok(new { ok = true });
    if (result.Error == "NotFound") return Results.NotFound(new { ok = false });

    return Results.BadRequest(new { ok = false, error = result.Error });
});

app.MapDelete("/api/activities/{activityId:int}", async (
    HttpContext ctx,
    int activityId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin || myId == null) return Results.Forbid();

    var reason = ctx.Request.Query["reason"].ToString();

    var result = await db.SoftDeleteActivityAsync(
        activityId,
        myId.Value,
        string.IsNullOrWhiteSpace(reason) ? null : reason
    );

    return result.Ok
        ? Results.Ok(new { ok = true })
        : result.Error == "NotFound"
            ? Results.NotFound()
            : Results.BadRequest(result.Error);
});


app.MapGet("/api/lead/activities/{activityId:int}", async (
    HttpContext ctx,
    int activityId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    var dto = await db.GetLeadActivityDetailsAsync(activityId, isAdmin ? null : myId);
    return dto == null ? Results.NotFound() : Results.Ok(dto);
});

app.MapGet("/api/lead/activities/{activityId:int}/eligible-instructors", async (
    HttpContext ctx,
    int activityId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    var list = await db.GetEligibleInstructorsForLeadActivityAsync(activityId, isAdmin ? null : myId);
    return Results.Ok(list);
});

app.MapGet("/api/lead/instances/{instanceId:int}/availability", async (
    HttpContext ctx,
    int instanceId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    var rows = await db.GetLeadInstanceAvailabilityAsync(instanceId, isAdmin ? null : myId);
    return Results.Ok(rows);
});

app.MapPost("/api/lead/instances/{instanceId:int}/approve", async (
    HttpContext ctx,
    int instanceId,
    ApproveReq req,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    if (req?.InstructorIds == null || req.InstructorIds.Count == 0)
        return Results.BadRequest("Missing instructorIds");

    var (ok, err) = await db.ApproveLeadAssignmentsAsync(
        instanceId,
        req.InstructorIds.Distinct().ToList(),
        actorInstructorId: myId ?? 0,
        isAdmin: isAdmin,
        note: req.Note
    );

    return ok ? Results.Ok(new { ok = true }) : Results.BadRequest(err);
});

app.MapPost("/api/lead/instances/{instanceId:int}/send-availability-reminder", async (
    HttpContext ctx,
    int instanceId,
    ReminderReq body,
    Db db,
    IConfiguration cfg,
    EmailService emailSvc,
    AuditService audit) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin && myId == null) return Results.Unauthorized();

    var onlyNotResponded = body?.OnlyNotResponded ?? true;

    var (ok, err, emails) = await db.BuildLeadAvailabilityReminderEmailsAsync(
        instanceId,
        actorInstructorId: myId ?? 0,
        isAdmin: isAdmin,
        onlyNotResponded: onlyNotResponded,
        cfg: cfg
    );

    if (!ok) return Results.BadRequest(err);

    int sentNow = 0;
    foreach (var e in emails)
    {
        var emailId = await emailSvc.QueueAsync(e.ToEmail, e.Subject, e.BodyHtml, e.RelatedEntity, e.RelatedId);
        var sent = await emailSvc.TrySendQueuedNowAsync(
            ctx,
            emailId,
            e.ToEmail,
            e.Subject,
            e.BodyHtml,
            e.RelatedEntity,
            e.RelatedId,
            actorInstructorId: myId,
            attemptNo: 1
        );

        if (sent) sentNow++;
    }

    await audit.WriteAsync(ctx, myId, "SendAvailabilityReminder", "ActivityInstance", instanceId.ToString(),
        new { onlyNotResponded, queued = emails.Count, sentNow });

    return Results.Ok(new { ok = true, queued = emails.Count, sentNow });
});


// =======================
// Calendar / Gantt / Activities / Courses / Instructors (כמו אצלך)
// =======================

app.MapGet("/api/activities/calendar", async (
    HttpContext ctx,
    DateTime from,
    DateTime to,
    int? activityTypeId,
    Db db) =>
{
    try
    {
        var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
        if (!isAuth) return Results.Unauthorized();

        var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Local).ToUniversalTime();
        var toUtc = DateTime.SpecifyKind(to, DateTimeKind.Local).ToUniversalTime();

        // Admin רואה הכל => null, אחרים רק את עצמם
        int? myInstructorId = isAdmin ? null : myId;

        var rows = await db.GetActivitiesCalendarAsync(fromUtc, toUtc, activityTypeId, myInstructorId);
        return Results.Ok(rows);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/me", async (HttpContext ctx, Db db) =>
{
    if (ctx.User?.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    var email = ctx.User.FindFirstValue(ClaimTypes.Email);
    if (string.IsNullOrWhiteSpace(email))
        return Results.Unauthorized();

    var me = await db.GetMeByEmailAsync(email);
    if (me == null) return Results.Unauthorized();

    return Results.Ok(me);
});

// =======================
// MY ASSIGNMENTS (Instructor homepage)
// =======================
app.MapGet("/api/assignments/my", async (
    HttpContext ctx,
    DateTime? from,
    DateTime? to,
    Db db) =>
{
    var (isAuth, _, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (myId == null) return Results.Unauthorized();

    DateTime? fromUtc = from.HasValue ? DateTime.SpecifyKind(from.Value, DateTimeKind.Local).ToUniversalTime() : null;
    DateTime? toUtc   = to.HasValue   ? DateTime.SpecifyKind(to.Value,   DateTimeKind.Local).ToUniversalTime() : null;

    var rows = await db.GetMyAssignmentsAsync(myId.Value, fromUtc, toUtc);
    return Results.Ok(rows);
});

app.MapGet("/api/activities/gantt", async (
    DateTime from,
    DateTime to,
    int? activityTypeId,
    string? q,
    Db db) =>
{
    try
    {
        var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Local).ToUniversalTime();
        var toUtc = DateTime.SpecifyKind(to, DateTimeKind.Local).ToUniversalTime();

        var rows = await db.GetGanttAsync(fromUtc, toUtc, activityTypeId, q);
        return Results.Ok(rows);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/activities/edit/{activityId:int}", async (int activityId, Db db) =>
{
    try
    {
        var dto = await db.GetActivityForEditAsync(activityId);
        return dto == null ? Results.NotFound() : Results.Ok(dto);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapPut("/api/activities/edit/{activityId:int}", async (int activityId, ActivityUpdateDto dto, Db db) =>
{
    try
    {
        var (ok, err) = await db.UpdateActivityAsync(activityId, dto);
        return ok ? Results.NoContent() : Results.BadRequest(err);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapPost("/api/activities", async (
    HttpContext ctx,
    ActivityCreateDto dto,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin || myId == null) return Results.Forbid();

    if (string.IsNullOrWhiteSpace(dto.ActivityName)) return Results.BadRequest("ActivityName is required");
    if (dto.ActivityTypeId <= 0) return Results.BadRequest("ActivityTypeId is required");
    if (dto.CourseId <= 0) return Results.BadRequest("CourseId is required");
    if (dto.LeadInstructorId <= 0) return Results.BadRequest("LeadInstructorId is required");
    if (dto.Instances == null || dto.Instances.Count == 0) return Results.BadRequest("At least one instance is required");

    try
    {
        var activityId = await db.CreateActivityAsync(dto);
        return Results.Ok(new { ok = true, activityId });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/activities/search", async (
    int? activityId,
    string? name,
    int? activityTypeId,
    int? leadInstructorId,
    int? take,
    Db db) =>
{
    try
    {
        var rows = await db.SearchActivitiesAsync(
            activityId,
            name?.Trim(),
            activityTypeId,
            leadInstructorId,
            take ?? 50
        );
        return Results.Ok(rows);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/activities/{activityId:int}", async (int activityId, Db db) =>
{
    try
    {
        var dto = await db.GetActivityForEditAsync(activityId);
        return dto == null ? Results.NotFound() : Results.Ok(dto);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapPut("/api/activities/{activityId:int}", async (int activityId, ActivityUpdateDto dto, Db db) =>
{
    try
    {
        var (ok, err) = await db.UpdateActivityAsync(activityId, dto);
        return ok ? Results.NoContent() : Results.BadRequest(err);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/courses/by-type/{activityTypeId:int}", async (int activityTypeId, Db db) =>
{
    try { return Results.Ok(await db.GetCoursesByActivityTypeAsync(activityTypeId)); }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapGet("/api/instructors/by-course/{courseId:int}", async (int courseId, Db db) =>
{
    try { return Results.Ok(await db.GetInstructorsByCourseAsync(courseId)); }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapGet("/api/courses", async (Db db) =>
{
    return Results.Ok(await db.GetCoursesAsync());
});

app.MapGet("/api/instructors", async (Db db) =>
{
    return Results.Ok(await db.GetInstructorsAsync());
});

app.MapPost("/api/instructors", async (
    HttpContext ctx,
    InstructorCreateDto dto,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin) return Results.Forbid();

    if (string.IsNullOrWhiteSpace(dto.FullName)) return Results.BadRequest("FullName is required");
    if (string.IsNullOrWhiteSpace(dto.Email)) return Results.BadRequest("Email is required");
    if (dto.Role != Roles.Admin && dto.Role != Roles.CourseManager && dto.Role != Roles.Instructor)
        return Results.BadRequest($"Role must be one of: {Roles.Admin}, {Roles.CourseManager}, {Roles.Instructor}");

    var (instructorId, err) = await db.CreateInstructorAsync(dto);
    if (err == "DuplicateEmail") return Results.Conflict(new { ok = false, error = "Email already exists" });

    return Results.Ok(new { ok = true, instructorId });
});

app.MapGet("/api/course-instructors/{courseId:int}", async (int courseId, Db db) =>
{
    return Results.Ok(await db.GetInstructorIdsForCourseAsync(courseId));
});

app.MapPut("/api/course-instructors/{courseId:int}", async (
    int courseId,
    CourseInstructorsPut body,
    Db db) =>
{
    if (body?.InstructorIds == null)
        return Results.BadRequest("Missing instructorIds");

    await db.SetCourseInstructorsAsync(
        courseId,
        body.InstructorIds.Distinct().ToList()
    );

    return Results.NoContent();
});

app.MapGet("/api/activity-types", async (Db db) =>
{
    try { return Results.Ok(await db.GetActivityTypesAsync()); }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapPost("/api/activity-types", async (ActivityTypeDto dto, Db db) =>
{
    if (string.IsNullOrWhiteSpace(dto.TypeName))
        return Results.BadRequest("TypeName is required");

    try
    {
        var id = await db.CreateActivityTypeAsync(dto.TypeName.Trim());
        return Results.Ok(new { activityTypeId = id });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapPut("/api/activity-types/{id:int}", async (int id, ActivityTypeDto dto, Db db) =>
{
    if (string.IsNullOrWhiteSpace(dto.TypeName))
        return Results.BadRequest("TypeName is required");

    try
    {
        var ok = await db.UpdateActivityTypeAsync(id, dto.TypeName.Trim());
        return ok ? Results.NoContent() : Results.NotFound("ActivityType not found");
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

app.MapDelete("/api/activity-types/{id:int}", async (int id, Db db) =>
{
    try
    {
        var (ok, err) = await db.DeleteActivityTypeAsync(id);
        return ok ? Results.NoContent() : Results.BadRequest(err);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

// =======================
// HARD DELETE Activity (Admin only)
// =======================
app.MapDelete("/api/admin/activities/{activityId:int}", async (
    HttpContext ctx,
    int activityId,
    Db db) =>
{
    var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
    if (!isAuth) return Results.Unauthorized();
    if (!isAdmin || myId == null) return Results.Forbid();

    var result = await db.DeleteActivityAsync(
        activityId,
        myId.Value,
        "HardDelete by Admin"
    );

    return result.Ok
        ? Results.Ok(new { ok = true })
        : result.Error == "NotFound"
            ? Results.NotFound()
            : Results.BadRequest(result.Error);
});

var api = app.MapGroup("/api/api");
var apiAdmin = app.MapGroup("/api/api/admin");

apiAdmin.MapAdminEndpoints();

app.UseDefaultFiles();
app.UseStaticFiles();

app.Run();
