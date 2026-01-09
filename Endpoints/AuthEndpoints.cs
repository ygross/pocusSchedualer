using System.Security.Claims;
using System.Security.Cryptography;
using System.Net;
using System.Net.Mail;
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
            IConfiguration cfg) =>
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(email))
                return Results.BadRequest();

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

            // תמיד שומרים ב-Outbox
            await db.EnqueueEmailAsync(email, subject, body, "OtpCodes", otpId.ToString());

            // ניסיון SMTP מיידי (כמו שהיה אצלך)
            try
            {
                await SendEmailSmtpAsync(cfg, email, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[SMTP ERROR] " + ex);
                return Results.Problem("Failed to send OTP email");
            }

            return Results.Ok(new { ok = true });
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

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(code))
                return Results.BadRequest();

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
        // Impersonate (כמו שהיה)
        // =======================
        app.MapPost("/api/auth/impersonate", async (HttpContext ctx, Db db, ImpersonateReq req) =>
        {
            var email = (req.Email ?? "").Trim().ToLowerInvariant();

            if (email != "ygross@bgu.ac.il")
                return Results.Forbid();

            var me = await db.ImpersonateByEmailAsync(email);
            if (me == null) return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, me.Email),
                new Claim("fullName", me.FullName),
                new Claim(ClaimTypes.Role, me.RoleName),
                new Claim("department", me.Department ?? "")
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

            return Results.Ok(new { ok = true });
        });
    }

    private static async Task SendEmailSmtpAsync(
        IConfiguration cfg,
        string to,
        string subject,
        string bodyHtml)
    {
        var host = cfg["Smtp:Host"] ?? throw new Exception("Missing Smtp:Host");
        var port = int.Parse(cfg["Smtp:Port"] ?? "587");
        var enableSsl = bool.Parse(cfg["Smtp:EnableSsl"] ?? "true");
        var user = cfg["Smtp:User"] ?? "";
        var pass = cfg["Smtp:Pass"] ?? "";
        var from = cfg["Smtp:From"] ?? user;

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Credentials = new NetworkCredential(user, pass),
        };

        using var msg = new MailMessage(from, to, subject, bodyHtml)
        {
            IsBodyHtml = true
        };

        await client.SendMailAsync(msg);
    }
}
