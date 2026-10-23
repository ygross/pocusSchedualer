using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class AdminCourseInstructorsEndpoints
{
    public static void MapAdminCourseInstructorsEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapGet("/course-instructors", async (HttpContext ctx, Db db) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            return Results.Ok(await db.GetAdminCourseInstructorsAsync());
        });

        admin.MapGet("/course-instructors/courses", async (HttpContext ctx, Db db) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            return Results.Ok(await db.GetAdminCoursesWithInstructorIdsAsync());
        });

        admin.MapPost("/course-instructors/{instructorId:int}/status", async (
            HttpContext ctx,
            int instructorId,
            Db db,
            AdminInstructorStatusDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (instructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid instructorId" });

            var normalized = NormalizeStatus(dto?.Status);
            if (normalized == null)
                return Results.BadRequest(new { ok = false, message = "Unsupported status" });

            var rows = await db.UpdateInstructorStatusAdminAsync(instructorId, normalized);
            return rows > 0 ? Results.Ok(new { ok = true, status = normalized }) : Results.NotFound(new { ok = false });
        });

        admin.MapPut("/course-instructors/course/{courseId:int}/instructors", async (
            HttpContext ctx,
            int courseId,
            Db db,
            AdminCourseInstructorsSaveDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            await db.SetCourseInstructorsAsync(courseId, dto?.InstructorIds ?? new List<int>());
            return Results.Ok(new { ok = true });
        });

        admin.MapPut("/course-instructors/{instructorId:int}/courses", async (
            HttpContext ctx,
            int instructorId,
            Db db,
            AdminInstructorCoursesDto dto) =>
        {
            if (!IsAdmin(ctx)) return Results.Forbid();
            if (instructorId <= 0) return Results.BadRequest(new { ok = false, message = "Invalid instructorId" });

            await db.SaveInstructorCoursesAdminAsync(instructorId, dto?.CourseIds ?? new List<int>());
            return Results.Ok(new { ok = true });
        });
    }

    private static string? NormalizeStatus(string? status)
    {
        var s = (status ?? "").Trim().ToLowerInvariant();
        return s switch
        {
            "active" => "Active",
            "inactive" => "Inactive",
            "disabled" => "Disabled",
            "declined" => "Declined",
            "pendingapproval" => "PendingApproval",
            _ => null
        };
    }

    private static bool IsAdmin(HttpContext ctx) =>
        AuthHelpers.GetAuthInfo(ctx) is { isAuth: true, isAdmin: true };
}
