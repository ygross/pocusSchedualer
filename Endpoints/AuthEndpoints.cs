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

            var code = Db.GenerateOtpCode();
            var salt = Db.GenerateSalt();
            var hash = Db.HashOtp(code, salt);

            var expiresUtc = DateTime.UtcNow.AddMinutes(minutes);
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var ua = ctx.Request.Headers.UserAgent.ToString();

            var otpId = await db.CreateOtpAsync(
                email, hash, salt, expiresUtc, ip, ua, maxAttempts: 6
            );

            var subject = "Pocus Scheduler - קוד התחברות (OTP)";
            var body = $@"
<div style=""font-family:Arial;direction:rtl"">
  <h3>קוד התחברות למערכת</h3>
  <div>הקוד שלך הוא:</div>
  <div style=""font-size:28px;font-weight:bold;letter-spacing:3px;margin:10px 0"">{code}</div>
  <div>תוקף הקוד: {minutes} דקות.</div>
</div>";

            // Queue + try send now (דרך EmailService)
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
                attemptNo: 1
            );

            if (!sent)
                return Results.Problem("Failed to send OTP email");

            return Results.Ok(new { ok = true, emailId });
        });

        // =======================
        // OTP - Verify
        // =======================
        app.MapPost("/api/auth/otp/verify", async (
            HttpContext ctx,
            OtpVerifyDto dto,
            Db db) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            var code = dto.Code?.Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return Results.BadRequest(new { ok = false, error = "Missing email/code" });

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
        // =======================
        app.MapPost("/api/auth/impersonate", async (
            HttpContext ctx,
            Db db,
            ImpersonateReq req) =>
        {
            var email = (req.Email ?? "").Trim().ToLowerInvariant();

            // ⚠️ זה עדיין “קשיח” כמו שהיה אצלך
            if (email != "ygross@bgu.ac.il")
                return Results.Forbid();

            var me = await db.ImpersonateByEmailAsync(email);
            if (me == null)
                return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim("fullName", me.FullName),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("department", me.Department ?? "")
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return Results.Ok(new { ok = true });
        });
    }
}
