using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

public sealed class OtpStore
{
    private readonly Db _db;

    public OtpStore(Db db) => _db = db;

    public async Task<(string status, string? message)> RequestOtpAsync(string email, string? ip, string? ua)
    {
        var em = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(em))
            return ("ERROR", "Missing email");

        await using var c = _db.Open();

        // 1) Verify instructor exists + active
        var cmd = new SqlCommand(@"
SELECT TOP 1 InstructorId, FullName, Role, Status
FROM dbo.Instructors
WHERE Email=@Email;", c);
        cmd.Parameters.AddWithValue("@Email", em);

        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync())
            return ("REGISTER", "Email not found");

        var status = (string)r["Status"];
        if (!string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase))
            return ("NOT_ACTIVE", "User not active/approved");

        var fullName = (string)r["FullName"];

        // 2) Generate OTP
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("000000");
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = SHA256.HashData(Concat(salt, Encoding.UTF8.GetBytes(code)));

        var ttlMinutes = 10;
        var maxAttempts = 6;
        var expUtc = DateTime.UtcNow.AddMinutes(ttlMinutes);

        var subject = "קוד כניסה למערכת PocusSchedualer";
        var body =
            $"<div style='font-family:Segoe UI,Arial'>שלום {fullName},<br/>קוד הכניסה שלך: <b style='font-size:22px'>{code}</b><br/>בתוקף ל-{ttlMinutes} דקות.</div>";

        // 3) Save OTP + queue email
        var ins = new SqlCommand(@"
INSERT INTO dbo.OtpCodes(Email, CodeHash, Salt, CreatedAtUtc, ExpiresAtUtc, Attempts, MaxAttempts, IsUsed, RequestIp, UserAgent)
VALUES(@Email, @Hash, @Salt, SYSUTCDATETIME(), @Exp, 0, @MaxAttempts, 0, @Ip, @Ua);

DECLARE @OtpId BIGINT = SCOPE_IDENTITY();

INSERT INTO dbo.EmailOutbox(ToEmail, Subject, BodyHtml, RelatedEntity, RelatedId, Status, CreatedAtUtc)
VALUES(@Email, @Subject, @Body, 'Otp', CONVERT(nvarchar(50), @OtpId), 'Queued', SYSUTCDATETIME());
", c);

        ins.Parameters.AddWithValue("@Email", em);
        ins.Parameters.AddWithValue("@Hash", hash);
        ins.Parameters.AddWithValue("@Salt", salt);
        ins.Parameters.AddWithValue("@Exp", expUtc);
        ins.Parameters.AddWithValue("@MaxAttempts", maxAttempts);
        ins.Parameters.AddWithValue("@Ip", (object?)ip ?? DBNull.Value);
        ins.Parameters.AddWithValue("@Ua", (object?)ua ?? DBNull.Value);
        ins.Parameters.AddWithValue("@Subject", subject);
        ins.Parameters.AddWithValue("@Body", body);

        await ins.ExecuteNonQueryAsync();

        return ("OK", null);
    }

    private static byte[] Concat(byte[] a, byte[] b)
    {
        var res = new byte[a.Length + b.Length];
        Buffer.BlockCopy(a, 0, res, 0, a.Length);
        Buffer.BlockCopy(b, 0, res, a.Length, b.Length);
        return res;
    }
}
