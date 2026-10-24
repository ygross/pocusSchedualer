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

            // Rate limit: max 3 OTP requests per email per 10 minutes
            var recentCount = await db.CountRecentOtpRequestsAsync(email, windowMinutes: 10);
            if (recentCount >= 3)
                return Results.Ok(new { ok = false, sent = false, rateLimited = true, message = "יותר מדי בקשות. נסה שוב בעוד כמה דקות." });

            var authState = await db.GetInstructorAuthStateByEmailAsync(email);
            if (authState == null)
            {
                // Return 200 (not 404) to avoid revealing whether an email is registered
                return Results.Ok(new
                {
                    ok = false,
                    sent = false,
                    notRegistered = true,
                    redirect = $"CreateInstructor.html?email={Uri.EscapeDataString(email)}"
                });
            }

            var statusRaw = authState.Status ?? string.Empty;
            var status = statusRaw.Trim().ToLowerInvariant();
            var isAllowed = status is "active" or "approved";

            if (!isAllowed)
            {
                // Return 200 (not 403) — same HTTP status for all blocked cases
                var accountStatus = status switch
                {
                    "pendingapproval" => "pending",
                    "declined"        => "declined",
                    "inactive"        => "inactive",
                    "suspended"       => "suspended",
                    _                 => "blocked"
                };
                return Results.Ok(new { ok = false, sent = false, accountStatus, message = "אם המייל רשום ופעיל, נשלח קוד." });
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

            return Results.Ok(new { ok = true, sent = true, emailId });
        });

        api.MapPost("/auth/otp/verify", async (HttpContext ctx, OtpVerifyDto dto, Db db, IConfiguration cfg) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            var code = dto.Code?.Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return Results.BadRequest(new { ok = false, error = "Missing email/code" });

            // DevBypass — only active in Development environment
            var bypassEnabled = cfg.GetValue("Otp:DevBypassEnabled", false);
            if (bypassEnabled)
            {
                var bypassEmails = cfg.GetSection("Otp:DevBypassEmails").Get<string[]>() ?? [];
                var bypassCode = cfg.GetValue("Otp:DevBypassCode", "");
                if (bypassEmails.Contains(email) && code == bypassCode)
                    goto LoginSuccess;
            }

            {
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
            }

            LoginSuccess:

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
        api.MapPost("/auth/bootstrap-sysadmin", async (HttpContext ctx, Db db, IConfiguration cfg2) =>
        {
            if (ctx.User?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var email = ctx.User.FindFirstValue(ClaimTypes.Email)?.Trim().ToLowerInvariant();
            var sysEmail = cfg2["SystemAdmin:SeedEmail"] ?? "ygross@bgu.ac.il";
            if (email != sysEmail) return Results.Forbid();

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

        api.MapPost("/auth/impersonate", async (HttpContext ctx, Db db, IConfiguration cfg, ImpersonateReq req) =>
        {
            if (ctx.User?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var callerEmail = ctx.User.FindFirstValue(ClaimTypes.Email)?.Trim().ToLowerInvariant();
            var sysAdminEmail = cfg["SystemAdmin:SeedEmail"] ?? "ygross@bgu.ac.il";
            if (callerEmail != sysAdminEmail) return Results.Forbid();
            var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email)) return Results.BadRequest(new { ok = false, error = "Missing email" });

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
