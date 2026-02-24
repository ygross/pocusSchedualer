using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        // =======================
        // OTP - Request
        // =======================
        app.MapPost("/api/auth/otp/request", async (
            HttpContext ctx,
            OtpRequestDto dto,
            Db db,
            IConfiguration cfg,
            EmailService emailSvc) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                return Results.BadRequest(new { ok = false, error = "Missing email" });

            var me = await db.GetMeByEmailAsync(email);
            if (me == null)
                return Results.Unauthorized();

            var minutes = cfg.GetValue("Otp:ExpireMinutes", 10);
            var maxAttempts = cfg.GetValue("Otp:MaxAttempts", 6);

            var code = Db.GenerateOtpCode();
            var salt = Db.GenerateSalt();
            var hash = Db.HashOtp(code, salt);

            var expiresUtc = DateTime.UtcNow.AddMinutes(minutes);
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var ua = ctx.Request.Headers.UserAgent.ToString();

            var otpId = await db.CreateOtpAsync(
                email, hash, salt, expiresUtc, ip, ua, maxAttempts
            );

            var subject = "Pocus Scheduler - קוד התחברות (OTP)";
            var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h3>קוד התחברות למערכת</h3>
  <div>שלום {me.FullName},</div>
  <div>הקוד שלך הוא:</div>
  <div style=""font-size:28px;font-weight:bold;letter-spacing:3px;margin:10px 0"">{code}</div>
  <div>תוקף הקוד: {minutes} דקות.</div>
  <div style=""color:#9ca3af;font-size:12px;margin-top:16px"">אם לא ביקשת קוד זה, התעלם/י מהודעה זו.</div>
</div>";

            // Queue first (always succeeds if DB is up)
            var emailId = await emailSvc.QueueAsync(email, subject, body, "OtpCodes", otpId.ToString());

            // Try to send now via SMTP – failure is non-fatal (email stays Queued for retry)
            var sent = await emailSvc.TrySendQueuedNowAsync(
                ctx,
                emailId,
                email,
                subject,
                body,
                relatedEntity: "OtpCodes",
                relatedId: otpId.ToString(),
                actorInstructorId: null,
                attemptNo: 1
            );

            // Return ok regardless of SMTP result – OTP is in DB, email is in outbox
            return Results.Ok(new { ok = true, emailSent = sent });
        });

        // =======================
        // OTP - Verify
        // =======================
        app.MapPost("/api/auth/otp/verify", async (
            HttpContext ctx,
            OtpVerifyDto dto,
            Db db,
            IConfiguration cfg) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            var code = dto.Code?.Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return Results.BadRequest(new { ok = false, error = "Missing email/code" });

            // ── DevBypass (development / troubleshooting) ──────────────
            bool bypassed = false;
            if (cfg.GetValue<bool>("Otp:DevBypassEnabled", false))
            {
                var devCode   = cfg.GetValue<string>("Otp:DevBypassCode", "") ?? "";
                var devEmails = cfg.GetSection("Otp:DevBypassEmails").Get<string[]>() ?? Array.Empty<string>();
                if (devCode == code && devEmails.Contains(email, StringComparer.OrdinalIgnoreCase))
                    bypassed = true;
            }
            // ─────────────────────────────────────────────────────────────

            if (!bypassed)
            {
                var otp = await db.GetLatestOtpAsync(email);
                if (otp == null)
                    return Results.Unauthorized();

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

            var me = await db.GetMeByEmailAsync(email);
            if (me == null)
                return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("fullName", me.FullName),
                new Claim("department", me.Department ?? ""),
                new Claim("instructorId", me.InstructorId.ToString())
            };

            var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(id)
            );

            return Results.Ok(new { ok = true, me });
        });

        // =======================
        // Impersonate
        // Only the user ygross@bgu.ac.il (when already logged in) may impersonate others.
        // =======================
        app.MapPost("/api/auth/impersonate", async (
            HttpContext ctx,
            Db db,
            ImpersonateReq req) =>
        {
            // 1) Guard: only the designated super-user may impersonate
            var callerEmail = ctx.User?.FindFirst(ClaimTypes.Email)?.Value?.Trim().ToLowerInvariant();
            if (callerEmail != "ygross@bgu.ac.il")
                return Results.Forbid();

            // 2) Target email (who to impersonate)
            var targetEmail = (req.Email ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(targetEmail))
                return Results.BadRequest(new { ok = false, error = "Missing email" });

            // 3) Look up target
            var me = await db.ImpersonateByEmailAsync(targetEmail);
            if (me == null)
                return Results.NotFound(new { ok = false, error = "User not found" });

            // 4) Sign in as target (full claims, including instructorId)
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("fullName", me.FullName),
                new Claim("department", me.Department ?? ""),
                new Claim("instructorId", me.InstructorId.ToString())
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return Results.Ok(new { ok = true, me });
        });

        // =======================
        // Logout
        // =======================
        app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { ok = true });
        });
    }
}
