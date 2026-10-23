using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/me", async (HttpContext ctx, Db db) =>
        {
            if (ctx.User?.Identity?.IsAuthenticated != true)
                return Results.Unauthorized();

            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
                return Results.Unauthorized();

            var me = await db.GetMeByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var realName = ctx.User.FindFirstValue("realName");
            var isImpersonating = !string.IsNullOrEmpty(realName);

            return Results.Ok(new
            {
                me.InstructorId,
                me.Email,
                me.FullName,
                me.RoleName,
                me.Department,
                me.Status,
                isAdmin = !isImpersonating && (string.Equals(me.RoleName, Roles.Admin, StringComparison.OrdinalIgnoreCase) || string.Equals(me.RoleName, Roles.SystemAdmin, StringComparison.OrdinalIgnoreCase)),
                isCourseManager = string.Equals(me.RoleName, Roles.CourseManager, StringComparison.OrdinalIgnoreCase),
                isInstructor = string.Equals(me.RoleName, Roles.Instructor, StringComparison.OrdinalIgnoreCase),
                isImpersonating,
                realName = isImpersonating ? realName : null
            });
        });

        api.MapPut("/me", async (HttpContext ctx, Db db, SelfUpdateDto dto) =>
        {
            if (ctx.User?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var email = ctx.User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email)) return Results.Unauthorized();
            var me = await db.GetMeByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var fullName = (dto.FullName ?? "").Trim();
            if (string.IsNullOrWhiteSpace(fullName))
                return Results.BadRequest(new { ok = false, error = "שם מלא הוא שדה חובה" });

            var ok = await db.UpdateInstructorSelfAsync(me.InstructorId, fullName, dto.Phone?.Trim(), dto.Department?.Trim());
            return ok ? Results.Ok(new { ok = true }) : Results.Problem("Update failed");
        });

        api.MapPost("/auth/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { ok = true });
        });

        api.MapPost("/auth/otp/request", async (
            HttpContext ctx,
            OtpRequestDto dto,
            Db db,
            IConfiguration cfg,
            EmailService emailSvc) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                return Results.BadRequest(new { ok = false, error = "Missing email" });

            var authState = await db.GetInstructorAuthStateByEmailAsync(email);
            if (authState == null)
            {
                return Results.NotFound(new
                {
                    ok = false,
                    notFound = true,
                    redirect = $"CreateInstructor.html?email={Uri.EscapeDataString(email)}"
                });
            }

            var statusRaw = authState.Status ?? string.Empty;
            var status = statusRaw.Trim().ToLowerInvariant();
            var isAllowed = status is "active" or "approved";

            if (!isAllowed)
            {
                if (status == "pendingapproval")
                    return Results.Json(new { ok = false, pending = true, message = "Account pending admin approval" }, statusCode: StatusCodes.Status403Forbidden);

                if (status == "declined")
                    return Results.Json(new { ok = false, declined = true, message = "Account access declined" }, statusCode: StatusCodes.Status403Forbidden);

                if (status == "inactive")
                    return Results.Json(new { ok = false, inactive = true, message = "Account is inactive" }, statusCode: StatusCodes.Status403Forbidden);

                if (status == "suspended")
                    return Results.Json(new { ok = false, suspended = true, message = "Account is suspended" }, statusCode: StatusCodes.Status403Forbidden);

                return Results.Json(new { ok = false, forbidden = true, message = "Account not allowed", debugStatus = statusRaw }, statusCode: StatusCodes.Status403Forbidden);
            }

            var minutes = cfg.GetValue("Otp:ExpireMinutes", 10);
            var code = Db.GenerateOtpCode();
            var salt = Db.GenerateSalt();
            var hash = Db.HashOtp(code, salt);
            var expiresUtc = DateTime.UtcNow.AddMinutes(minutes);
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var ua = ctx.Request.Headers.UserAgent.ToString();

            var otpId = await db.CreateOtpAsync(email, hash, salt, expiresUtc, ip, ua, maxAttempts: 6);

            var subject = "Pocus Scheduler - קוד התחברות (OTP)";
            var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h3>קוד התחברות למערכת</h3>
  <div>הקוד שלך הוא:</div>
  <div style=""font-size:28px;font-weight:bold;letter-spacing:3px;margin:10px 0"">{code}</div>
  <div>תוקף הקוד: {minutes} דקות.</div>
</div>";

            var emailId = await emailSvc.QueueAsync(email, subject, body, "OtpCodes", otpId.ToString());

            var sent = await emailSvc.TrySendQueuedNowAsync(
                ctx,
                emailId,
                email,
                subject,
                body,
                relatedEntity: "OtpCodes",
                relatedId: otpId.ToString(),
                actorInstructorId: null,
                attemptNo: 1);

            if (!sent)
                return Results.Problem("Failed to send OTP email");

            return Results.Ok(new { ok = true, emailId });
        });

        api.MapPost("/auth/otp/verify", async (HttpContext ctx, OtpVerifyDto dto, Db db) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            var code = dto.Code?.Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return Results.BadRequest(new { ok = false, error = "Missing email/code" });

            var otp = await db.GetLatestOtpAsync(email);
            if (otp == null) return Results.Unauthorized();

            var (hash, salt, attempts, maxAttempts, used, expires) = otp.Value;
            if (used || attempts >= maxAttempts || DateTime.UtcNow > expires)
                return Results.Unauthorized();

            var calc = Db.HashOtp(code, salt);
            if (!CryptographicOperations.FixedTimeEquals(calc, hash))
            {
                await db.IncrementOtpAttemptsAsync(email);
                return Results.Unauthorized();
            }

            await db.MarkOtpUsedAsync(email);

            var me = await db.GetMeByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("fullName", me.FullName),
                new Claim("department", me.Department ?? string.Empty),
                new Claim("instructorId", me.InstructorId.ToString())
            };

            var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(id));

            return Results.Ok(new
            {
                ok = true,
                me = new
                {
                    me.InstructorId,
                    me.Email,
                    me.FullName,
                    me.RoleName,
                    me.Department,
                    me.Status
                }
            });
        });

        // Bootstrap: updates DB role to SystemAdmin AND re-issues the cookie immediately.
        // Only works for ygross@bgu.ac.il. No logout/login needed — just reload after calling.
        api.MapPost("/auth/bootstrap-sysadmin", async (HttpContext ctx, Db db) =>
        {
            if (ctx.User?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var email = ctx.User.FindFirstValue(ClaimTypes.Email)?.Trim().ToLowerInvariant();
            if (email != "ygross@bgu.ac.il") return Results.Forbid();

            await db.EnsureSysAdminSeedAsync();

            var me = await db.GetMeByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("fullName", me.FullName),
                new Claim("department", me.Department ?? string.Empty),
                new Claim("instructorId", me.InstructorId.ToString())
            };
            var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(id));

            return Results.Ok(new { ok = true, roleName = me.RoleName });
        });

        api.MapPost("/auth/impersonate", async (HttpContext ctx, Db db, ImpersonateReq req) =>
        {
            var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
            if (email != "ygross@bgu.ac.il") return Results.Forbid();

            var me = await db.ImpersonateByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim("fullName", me.FullName),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("department", me.Department ?? string.Empty),
                new Claim("instructorId", me.InstructorId.ToString())
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return Results.Ok(new { ok = true });
        });
    }
}
