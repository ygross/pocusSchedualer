using System.Security.Claims;
using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class SysAdminEndpoints
{
    public static void MapSysAdminEndpoints(this IEndpointRouteBuilder grp)
    {
        // All endpoints require SystemAdmin role
        static bool IsSysAdmin(HttpContext ctx) =>
            ctx.User?.Identity?.IsAuthenticated == true &&
            ctx.User.IsInRole(Roles.SystemAdmin);

        grp.MapGet("/dashboard", async (HttpContext ctx, Db db) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var dto = await db.GetSysAdminDashboardAsync();
            return Results.Ok(new
            {
                dto.ActiveInstructors,
                dto.SysAdminCount,
                dto.EmailsSentToday,
                dto.EmailsFailedToday,
                dto.AuditActionsToday,
                DbTimeUtc = dto.DbTimeUtc,
                AppHost = System.Net.Dns.GetHostName(),
                DotNetVersion = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                OS = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                AppStartUtc = System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime()
            });
        });

        grp.MapGet("/emails", async (HttpContext ctx, Db db,
            string? status, int days = 7) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var rows = await db.GetSysAdminEmailsAsync(
                string.IsNullOrWhiteSpace(status) ? null : status, days);
            return Results.Ok(rows);
        });

        grp.MapPost("/emails/{id:long}/resend", async (HttpContext ctx, Db db, long id) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var ok = await db.ResendEmailAsync(id);
            return ok ? Results.Ok(new { ok = true }) : Results.NotFound(new { ok = false, error = "Not found or not in Failed state" });
        });

        grp.MapGet("/audit", async (HttpContext ctx, Db db,
            int days = 7, string? entity = null, string? action = null, int? actorId = null) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var rows = await db.GetSysAdminAuditAsync(days,
                string.IsNullOrWhiteSpace(entity) ? null : entity,
                string.IsNullOrWhiteSpace(action) ? null : action,
                actorId);
            return Results.Ok(rows);
        });

        grp.MapGet("/errors", async (HttpContext ctx, Db db, int days = 7) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var dto = await db.GetSysAdminErrorsAsync(days);
            return Results.Ok(dto);
        });

        grp.MapGet("/instructors", async (HttpContext ctx, Db db,
            string? role = null, string? status = null) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var rows = await db.GetSysAdminInstructorsAsync(
                string.IsNullOrWhiteSpace(role) ? null : role,
                string.IsNullOrWhiteSpace(status) ? null : status);
            return Results.Ok(rows);
        });

        grp.MapPut("/instructors/{id:int}", async (HttpContext ctx, Db db, int id, SysAdminSetRoleDto dto) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(dto.Role) || string.IsNullOrWhiteSpace(dto.Status))
                return Results.BadRequest(new { ok = false, error = "Role and Status are required" });
            var ok = await db.SetInstructorRoleStatusAsync(id, dto.Role.Trim(), dto.Status.Trim());
            return ok ? Results.Ok(new { ok = true }) : Results.NotFound(new { ok = false, error = "Instructor not found" });
        });

        grp.MapPost("/maintenance/ensure-seed", async (HttpContext ctx, Db db) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            await db.EnsureSysAdminSeedAsync();
            return Results.Ok(new { ok = true });
        });

        grp.MapPost("/maintenance/run-migrations", async (HttpContext ctx, Db db) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            try
            {
                await db.RunMigrationsAsync();
                return Results.Ok(new { ok = true, message = "Migrations ran successfully" });
            }
            catch
            {
                return Results.Problem("Migration failed");
            }
        });

        grp.MapPost("/maintenance/clear-otps", async (HttpContext ctx, Db db, int olderThanDays = 7) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var deleted = await db.ClearOldOtpsAsync(olderThanDays);
            return Results.Ok(new { ok = true, deleted });
        });

        grp.MapPost("/maintenance/purge-logs", async (HttpContext ctx, Db db, int olderThanDays = 90) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            if (olderThanDays < 1)
                return Results.BadRequest(new { ok = false, error = "olderThanDays must be ≥ 1" });
            var result = await db.PurgeLogsAsync(olderThanDays);
            return Results.Ok(new { ok = true, result });
        });

        grp.MapDelete("/courses/{courseId:int}/force", async (HttpContext ctx, Db db, int courseId) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var result = await db.ForceDeleteCourseAsync(courseId);
            if (!result.Ok)
            {
                if (result.Error == "CourseNotFound")
                    return Results.NotFound(new { ok = false, error = "Course not found" });
                return Results.Problem(result.Error ?? "Unknown error");
            }
            return Results.Ok(new { ok = true, result });
        });

        grp.MapGet("/maintenance/system-info", (HttpContext ctx) =>
        {
            if (!IsSysAdmin(ctx)) return Results.Forbid();
            var proc = System.Diagnostics.Process.GetCurrentProcess();
            return Results.Ok(new
            {
                Host = System.Net.Dns.GetHostName(),
                OS = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                DotNet = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                ProcessId = proc.Id,
                AppStartUtc = proc.StartTime.ToUniversalTime(),
                UptimeMinutes = (int)(DateTime.UtcNow - proc.StartTime.ToUniversalTime()).TotalMinutes,
                WorkingSetMb = proc.WorkingSet64 / 1024 / 1024,
                NowUtc = DateTime.UtcNow
            });
        });
    }
}

public class SysAdminSetRoleDto
{
    public string Role { get; set; } = "";
    public string Status { get; set; } = "";
}
