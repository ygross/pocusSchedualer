using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Activities / Calendar / Gantt / Courses / Instructors / ActivityTypes / Soft-Deletes
/// Routes are mapped RELATIVE to /api (Program.cs creates api = app.MapGroup("/api")).
/// </summary>
public static class ActivitiesEndpoints
{
    public static void MapActivitiesEndpoints(this IEndpointRouteBuilder api)
    {
        // =======================
        // Calendar
        // =======================
        api.MapGet("/activities/calendar", async (
            HttpContext ctx,
            DateTime from,
            DateTime to,
            int? activityTypeId,
            string? mode,
            Db db) =>
        {
            try
            {
                var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
                if (!isAuth || myId == null) return Results.Unauthorized();

                var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Local).ToUniversalTime();
                var toUtc   = DateTime.SpecifyKind(to, DateTimeKind.Local).ToUniversalTime();

                var myInstructorId = myId.Value;
                var m = (mode ?? "instructor").Trim().ToLowerInvariant();

                int? scopeInstructorId = null; // Instructor menu scope (certifications)
                int? leadInstructorId  = null; // Lead menu scope

                switch (m)
                {
                    case "admin":
                        if (!isAdmin) return Results.Forbid();
                        break;

                    case "lead":
                        leadInstructorId = myInstructorId;
                        break;

                    default: // "instructor"
                        scopeInstructorId = myInstructorId;
                        break;
                }

                var rows = await db.GetActivitiesCalendarAsync(
                    fromUtc,
                    toUtc,
                    activityTypeId,
                    myInstructorId,
                    scopeInstructorId,
                    leadInstructorId);

                return Results.Ok(rows);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        // =======================
        // Gantt
        // =======================
        api.MapGet("/activities/gantt", async (
            DateTime from,
            DateTime to,
            int? activityTypeId,
            string? q,
            Db db) =>
        {
            try
            {
                var fromUtc = DateTime.SpecifyKind(from, DateTimeKind.Local).ToUniversalTime();
                var toUtc   = DateTime.SpecifyKind(to, DateTimeKind.Local).ToUniversalTime();

                var rows = await db.GetGanttAsync(fromUtc, toUtc, activityTypeId, q);
                return Results.Ok(rows);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        // =======================
        // Activity Edit (GET+PUT)
        // =======================
        api.MapGet("/activities/edit/{activityId:int}", async (
            HttpContext ctx,
            int activityId,
            Db db) =>
        {
            try
            {
                var (isAuth, isAdmin, isCourseManager, myId) = AuthHelpers.GetAuthInfoEx(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin && !isCourseManager) return Results.Forbid();

                // ⭐ Lead/CourseManager: only own activities
                if (isCourseManager && !isAdmin)
                {
                    if (myId is null) return Results.Unauthorized();
                    var owned = await db.IsActivityLedByAsync(activityId, myId.Value);
                    if (!owned) return Results.Forbid();
                }

                var dto = await db.GetActivityForEditAsync(activityId);
                return dto == null ? Results.NotFound() : Results.Ok(dto);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        api.MapPut("/activities/edit/{activityId:int}", async (
            HttpContext ctx,
            int activityId,
            ActivityUpdateDto dto,
            Db db) =>
        {
            try
            {
                var (isAuth, isAdmin, isCourseManager, myId) = AuthHelpers.GetAuthInfoEx(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin && !isCourseManager) return Results.Forbid();

                if (isCourseManager && !isAdmin)
                {
                    if (myId is null) return Results.Unauthorized();

                    var owned = await db.IsActivityLedByAsync(activityId, myId.Value);
                    if (!owned) return Results.Forbid();

                    // ⭐ Lead/CourseManager cannot change ownership
                    dto.LeadInstructorId = myId.Value;
                }

                var (ok, err) = await db.UpdateActivityAsync(activityId, dto);
                return ok ? Results.NoContent() : Results.BadRequest(err);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        // =======================
        // Search / Get / Update
        // =======================
        api.MapGet("/activities/search", async (
            HttpContext ctx,
            int? activityId,
            string? name,
            int? activityTypeId,
            int? leadInstructorId,
            int? take,
            Db db) =>
        {
            try
            {
                var (isAuth, isAdmin, isCourseManager, myId) = AuthHelpers.GetAuthInfoEx(ctx);
                if (!isAuth) return Results.Unauthorized();

                // Only Admin / CourseManager use this endpoint
                if (!isAdmin && !isCourseManager) return Results.Forbid();

                // ⭐ Lead/CourseManager: force scope to own activities
                if (isCourseManager && !isAdmin)
                {
                    if (myId is null) return Results.Unauthorized();
                    leadInstructorId = myId;
                }

                var rows = await db.SearchActivitiesAsync(
                    activityId,
                    name?.Trim(),
                    activityTypeId,
                    leadInstructorId,
                    take ?? 50
                );
                return Results.Ok(rows);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        api.MapGet("/activities/{activityId:int}", async (
            HttpContext ctx,
            int activityId,
            Db db) =>
        {
            try
            {
                var (isAuth, isAdmin, isCourseManager, myId) = AuthHelpers.GetAuthInfoEx(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin && !isCourseManager) return Results.Forbid();

                if (isCourseManager && !isAdmin)
                {
                    if (myId is null) return Results.Unauthorized();
                    var owned = await db.IsActivityLedByAsync(activityId, myId.Value);
                    if (!owned) return Results.Forbid();
                }

                var dto = await db.GetActivityForEditAsync(activityId);
                return dto == null ? Results.NotFound() : Results.Ok(dto);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        api.MapPut("/activities/{activityId:int}", async (
            HttpContext ctx,
            int activityId,
            ActivityUpdateDto dto,
            Db db) =>
        {
            try
            {
                var (isAuth, isAdmin, isCourseManager, myId) = AuthHelpers.GetAuthInfoEx(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin && !isCourseManager) return Results.Forbid();

                if (isCourseManager && !isAdmin)
                {
                    if (myId is null) return Results.Unauthorized();
                    var owned = await db.IsActivityLedByAsync(activityId, myId.Value);
                    if (!owned) return Results.Forbid();

                    dto.LeadInstructorId = myId.Value;
                }

                var (ok, err) = await db.UpdateActivityAsync(activityId, dto);
                return ok ? Results.NoContent() : Results.BadRequest(err);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        // =======================
        // Courses / Instructors
        // =======================
        api.MapGet("/courses/by-type/{activityTypeId:int}", async (int activityTypeId, Db db) =>
        {
            try { return Results.Ok(await db.GetCoursesByActivityTypeAsync(activityTypeId)); }
            catch (Exception) { return Results.Problem("An error occurred"); }
        });

        api.MapGet("/instructors/by-course/{courseId:int}", async (int courseId, Db db) =>
        {
            try { return Results.Ok(await db.GetInstructorsByCourseAsync(courseId)); }
            catch (Exception) { return Results.Problem("An error occurred"); }
        });

        api.MapGet("/courses", async (Db db) => Results.Ok(await db.GetCoursesAsync()));
        api.MapGet("/instructors", async (Db db) => Results.Ok(await db.GetInstructorsAsync()));

        api.MapGet("/course-instructors/{courseId:int}", async (int courseId, Db db) =>
            Results.Ok(await db.GetInstructorIdsForCourseAsync(courseId)));

        api.MapPut("/course-instructors/{courseId:int}", async (int courseId, CourseInstructorsPut body, Db db) =>
        {
            if (body?.InstructorIds == null)
                return Results.BadRequest("Missing instructorIds");

            await db.SetCourseInstructorsAsync(courseId, body.InstructorIds.Distinct().ToList());
            return Results.NoContent();
        });

        // =======================
        // Activity Types
        // =======================
        api.MapGet("/activity-types", async (Db db) =>
        {
            try { return Results.Ok(await db.GetActivityTypesAsync()); }
            catch (Exception) { return Results.Problem("An error occurred"); }
        });

        api.MapPost("/activity-types", async (ActivityTypeDto dto, Db db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.TypeName))
                return Results.BadRequest("TypeName is required");

            try
            {
                var id = await db.CreateActivityTypeAsync(dto.TypeName.Trim());
                return Results.Ok(new { activityTypeId = id });
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        api.MapPut("/activity-types/{id:int}", async (int id, ActivityTypeDto dto, Db db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.TypeName))
                return Results.BadRequest("TypeName is required");

            try
            {
                var ok = await db.UpdateActivityTypeAsync(id, dto.TypeName.Trim());
                return ok ? Results.NoContent() : Results.NotFound("ActivityType not found");
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });
        // =======================
        // Create Activity + Instances (Admin only)
        // =======================
        api.MapPost("/activities/create", async (
            HttpContext ctx,
            ActivityCreateDto dto,
            Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth || myId == null) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            if (string.IsNullOrWhiteSpace(dto.ActivityName)) return Results.BadRequest(new { error = "ActivityName is required" });
            if (dto.ActivityTypeId <= 0) return Results.BadRequest(new { error = "ActivityTypeId is required" });
            if (dto.CourseId <= 0) return Results.BadRequest(new { error = "CourseId is required" });
            if (dto.LeadInstructorId <= 0) return Results.BadRequest(new { error = "LeadInstructorId is required" });
            if (dto.Instances == null || dto.Instances.Count == 0) return Results.BadRequest(new { error = "At least one instance is required" });

            var result = await db.CreateActivityWithInstancesAsync(dto, createdByInstructorId: myId.Value);
            return result.Ok
                ? Results.Ok(new { activityId = result.ActivityId })
                : Results.BadRequest(new { error = result.Error });
        });

        // Alias REST style
        api.MapPost("/activities", async (
            HttpContext ctx,
            ActivityCreateDto dto,
            Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth || myId == null) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            if (string.IsNullOrWhiteSpace(dto.ActivityName)) return Results.BadRequest(new { error = "ActivityName is required" });
            if (dto.ActivityTypeId <= 0) return Results.BadRequest(new { error = "ActivityTypeId is required" });
            if (dto.CourseId <= 0) return Results.BadRequest(new { error = "CourseId is required" });
            if (dto.LeadInstructorId <= 0) return Results.BadRequest(new { error = "LeadInstructorId is required" });
            if (dto.Instances == null || dto.Instances.Count == 0) return Results.BadRequest(new { error = "At least one instance is required" });

            var result = await db.CreateActivityWithInstancesAsync(dto, createdByInstructorId: myId.Value);
            return result.Ok
                ? Results.Ok(new { activityId = result.ActivityId })
                : Results.BadRequest(new { error = result.Error });
        });

        api.MapDelete("/activity-types/{id:int}", async (int id, Db db) =>
        {
            try
            {
                var (ok, err) = await db.DeleteActivityTypeAsync(id);
                return ok ? Results.NoContent() : Results.BadRequest(err);
            }
            catch (Exception)
            {
                return Results.Problem("An error occurred");
            }
        });

        // =======================
        // Soft Deletes (Admin only)
        // =======================
        api.MapDelete("/activity-instances/{instanceId:int}", async (
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

        api.MapDelete("/activities/{activityId:int}", async (HttpContext ctx, int activityId, Db db) =>
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
                    : Results.BadRequest(new { error = result.Error });
        });
    }
}
