using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Lead (CourseManager/Admin) endpoints. Routes are relative to /api.
/// </summary>
public static class LeadEndpoints
{
    public static void MapLeadEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/lead/activities", async (
            HttpContext ctx,
            int? activityTypeId,
            int? take,
            int? leadInstructorId,
            int? courseId,
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
                courseId: courseId,
                take: take ?? 200
            );

            return Results.Ok(rows);
        });

        api.MapGet("/lead/instances/{instanceId:int}/fairness", async (
            HttpContext ctx,
            int instanceId,
            Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Unauthorized();

            if (isAdmin)
            {
                var rows = await db.GetFairnessForInstanceAsync(instanceId);
                return Results.Ok(rows);
            }
            else
            {
                var rows = await db.GetFairnessForInstanceAsync(instanceId, myId);
                return Results.Ok(rows);
            }
        });

        api.MapGet("/lead/activities/{activityId:int}", async (
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

        api.MapGet("/lead/activities/{activityId:int}/eligible-instructors", async (
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

        api.MapGet("/lead/instances/{instanceId:int}/availability", async (
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

        api.MapPost("/lead/instances/{instanceId:int}/approve", async (
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

        api.MapPost("/lead/instances/{instanceId:int}/send-availability-reminder", async (
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

        // ── Pending Availability ───────────────────────────────────────────────
        api.MapGet("/lead/pending-availability", async (HttpContext ctx, int? courseId, int? activityTypeId, Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Unauthorized();

            var rows = await db.GetLeadPendingAvailabilityAsync(isAdmin ? null : myId, courseId, activityTypeId);
            return Results.Ok(rows);
        });

        // ── Needs Attention (understaffed) ────────────────────────────────────
        api.MapGet("/lead/needs-attention", async (HttpContext ctx, int? courseId, int? activityTypeId, Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Unauthorized();

            var rows = await db.GetLeadNeedsAttentionAsync(isAdmin ? null : myId, courseId, activityTypeId);
            return Results.Ok(rows);
        });

        // ── Conflict Report ───────────────────────────────────────────────────
        api.MapGet("/lead/conflicts", async (HttpContext ctx, int? courseId, int? activityTypeId, Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Unauthorized();

            var rows = await db.GetLeadConflictsAsync(isAdmin ? null : myId, courseId, activityTypeId);
            return Results.Ok(rows);
        });

        // ── Create Activity (Lead version) ─────────────────────────────────────
        api.MapPost("/lead/activities/create", async (
            HttpContext ctx,
            ActivityCreateDto dto,
            Db db,
            AuditService audit) =>
        {
            var (isAuth, isAdmin, isCourseManager, myId) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCourseManager) return Results.Forbid();
            if (myId == null) return Results.Unauthorized();

            if (dto == null) return Results.BadRequest("Body required");
            if (string.IsNullOrWhiteSpace(dto.ActivityName)) return Results.BadRequest("ActivityName required");
            if (dto.ActivityTypeId <= 0) return Results.BadRequest("ActivityTypeId required");
            if (dto.CourseId <= 0) return Results.BadRequest("CourseId required");
            if (dto.Instances == null || dto.Instances.Count == 0) return Results.BadRequest("At least one instance required");

            // CourseManager is always the lead of their own activity
            if (!isAdmin) dto.LeadInstructorId = myId.Value;
            if (dto.LeadInstructorId <= 0) dto.LeadInstructorId = myId.Value;

            var (ok, activityId, err) = await db.CreateActivityWithInstancesAsync(dto, createdByInstructorId: myId.Value);
            if (!ok) return Results.BadRequest(err);

            await audit.WriteAsync(ctx, myId, "LeadCreateActivity", "Activity", activityId.ToString(),
                new { dto.ActivityName, dto.ActivityTypeId, dto.CourseId, instances = dto.Instances.Count });

            return Results.Ok(new { ok = true, activityId });
        });
    }
}
