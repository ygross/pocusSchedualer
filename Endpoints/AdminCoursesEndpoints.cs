using PocusSchedualer.Endpoints;

namespace PocusSchedualer.Endpoints;

public static class AdminCoursesEndpoints
{
    public static void MapAdminCoursesEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapGet("/courses-admin", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            return Results.Ok(await db.GetAdminCoursesAsync());
        });

        admin.MapGet("/courses-admin/course-managers", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            return Results.Ok(await db.GetCourseManagersAsync());
        });

        admin.MapPost("/courses-admin", async (HttpContext ctx, Db db, AdminCourseUpsertDto dto) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            var validation = Validate(dto);
            if (validation != null) return Results.BadRequest(validation);

            try
            {
                var newId = await db.CreateAdminCourseAsync(dto);
                return Results.Ok(new { ok = true, courseId = newId });
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message, statusCode: 500);
            }
        });

        admin.MapPut("/courses-admin/{courseId:int}", async (HttpContext ctx, int courseId, Db db, AdminCourseUpsertDto dto) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            if (courseId <= 0) return Results.BadRequest("courseId is invalid");

            var validation = Validate(dto);
            if (validation != null) return Results.BadRequest(validation);

            try
            {
                var ok = await db.UpdateAdminCourseAsync(courseId, dto);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound(new { ok = false, error = "CourseNotFound" });
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message, statusCode: 500);
            }
        });

        admin.MapDelete("/courses-admin/{courseId:int}", async (HttpContext ctx, int courseId, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            if (courseId <= 0) return Results.BadRequest("courseId is invalid");

            var result = await db.DeleteAdminCourseAsync(courseId);
            if (result.Ok) return Results.Ok(new { ok = true });
            if (string.Equals(result.Error, "CourseNotFound", StringComparison.OrdinalIgnoreCase))
                return Results.NotFound(new { ok = false, error = "CourseNotFound" });

            return Results.BadRequest(new
            {
                ok = false,
                error = result.Error,
                activitiesCount = result.ActivitiesCount,
                instructorsCount = result.InstructorsCount
            });
        });
    }

    private static string? Validate(AdminCourseUpsertDto dto)
    {
        if (dto == null) return "Body is required";
        if (string.IsNullOrWhiteSpace(dto.CourseName)) return "CourseName is required";
        if (dto.CourseName.Trim().Length > 200) return "CourseName is too long";
        if ((dto.CourseCode ?? string.Empty).Trim().Length > 50) return "CourseCode is too long";
        if (dto.ActivityTypeId <= 0) return "ActivityTypeId is required";
        return null;
    }
}
