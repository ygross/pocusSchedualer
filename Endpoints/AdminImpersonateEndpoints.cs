using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace PocusSchedualer.Endpoints;

public static class AdminImpersonateEndpoints
{
    public static IEndpointRouteBuilder MapAdminImpersonateEndpoints(this IEndpointRouteBuilder admin)
    {
        // GET /api/admin/impersonate/users — list of all users available to impersonate
        admin.MapGet("/impersonate/users", async (HttpContext ctx, Db db) =>
        {
            if (!IsAdminOrImpersonating(ctx)) return Results.Forbid();
            var users = await db.GetInstructorsAsync();
            return Results.Ok(users.Select(u => new
            {
                u.InstructorId,
                u.FullName,
                u.Email,
                u.RoleName,
                u.Department
            }));
        });

        // POST /api/admin/impersonate/start — admin starts impersonating another user
        admin.MapPost("/impersonate/start", async (HttpContext ctx, Db db, ImpersonateStartReq req) =>
        {
            if (!IsAdminOrImpersonating(ctx)) return Results.Forbid();

            // Preserve the original admin identity (not the currently impersonated one)
            var realEmail = ctx.User.FindFirstValue("realEmail")
                         ?? ctx.User.FindFirstValue(ClaimTypes.Email)
                         ?? "";
            var realName = ctx.User.FindFirstValue("realName")
                        ?? ctx.User.FindFirstValue("fullName")
                        ?? "";
            var realIdStr = ctx.User.FindFirstValue("realInstructorId")
                         ?? ctx.User.FindFirstValue("instructorId")
                         ?? "";

            var target = await db.GetInstructorByIdAsync(req.InstructorId);
            if (target == null) return Results.NotFound(new { error = "User not found" });

            var claims = new List<Claim>
            {
                new(ClaimTypes.Email,   target.Email),
                new(ClaimTypes.Role,    target.RoleName),
                new("fullName",         target.FullName),
                new("department",       target.Department ?? ""),
                new("instructorId",     target.InstructorId.ToString()),
                new("realEmail",        realEmail),
                new("realName",         realName),
                new("realRole",         ctx.User.FindFirstValue(ClaimTypes.Role) ?? Roles.Admin),
                new("realInstructorId", realIdStr)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return Results.Ok(new { ok = true, name = target.FullName, role = target.RoleName });
        });

        // POST /api/admin/impersonate/stop — return to the real admin session
        admin.MapPost("/impersonate/stop", async (HttpContext ctx, Db db) =>
        {
            var realEmail = ctx.User.FindFirstValue("realEmail");
            if (string.IsNullOrEmpty(realEmail))
                return Results.BadRequest(new { error = "Not currently impersonating" });

            var realAdmin = await db.GetMeByEmailAsync(realEmail);
            if (realAdmin == null) return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new(ClaimTypes.Email,  realAdmin.Email),
                new(ClaimTypes.Role,   realAdmin.RoleName),
                new("fullName",        realAdmin.FullName),
                new("department",      realAdmin.Department ?? ""),
                new("instructorId",    realAdmin.InstructorId.ToString())
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return Results.Ok(new { ok = true });
        });

        return admin;
    }

    private static bool IsAdminOrImpersonating(HttpContext ctx)
    {
        if (ctx?.User?.Identity?.IsAuthenticated != true) return false;
        var role     = ctx.User.FindFirstValue(ClaimTypes.Role) ?? "";
        var realRole = ctx.User.FindFirstValue("realRole") ?? "";
        return string.Equals(role,     Roles.Admin,       StringComparison.OrdinalIgnoreCase)
            || string.Equals(role,     Roles.SystemAdmin,  StringComparison.OrdinalIgnoreCase)
            || string.Equals(realRole, Roles.Admin,       StringComparison.OrdinalIgnoreCase)
            || string.Equals(realRole, Roles.SystemAdmin,  StringComparison.OrdinalIgnoreCase);
    }
}
