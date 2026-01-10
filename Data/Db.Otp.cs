using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dapper;

/// <summary>
/// OTP (one-time password) persistence and helpers.
/// </summary>
public sealed partial class Db
{
    /// <summary>
    /// Creates a new OTP request record for the given email.
    /// </summary>
    /// <param name="email">Normalized user email.</param>
    /// <param name="hash">Hashed OTP code.</param>
    /// <param name="salt">Salt used for hashing.</param>
    /// <param name="expiresUtc">Expiration time in UTC.</param>
    /// <param name="ip">Requester IP (optional).</param>
    /// <param name="ua">Requester user-agent (optional).</param>
    /// <param name="maxAttempts">Maximum allowed verification attempts.</param>
    /// <returns>The created OTP record id.</returns>
    public async Task<long> CreateOtpAsync(
        string email,
        byte[] hash,
        byte[] salt,
        DateTime expiresUtc,
        string? ip,
        string? ua,
        int maxAttempts)
    {
        const string sql = @"
INSERT INTO dbo.OtpCodes
(Email, CodeHash, Salt, CreatedAtUtc, ExpiresAtUtc, Attempts, MaxAttempts, IsUsed, RequestIp, UserAgent)
OUTPUT INSERTED.OtpId
VALUES
(@Email, @Hash, @Salt, SYSUTCDATETIME(), @ExpiresAtUtc, 0, @MaxAttempts, 0, @Ip, @Ua);";

        await using var c = Open();
        return await c.QuerySingleAsync<long>(sql, new
        {
            Email = email,
            Hash = hash,
            Salt = salt,
            ExpiresAtUtc = expiresUtc,
            MaxAttempts = maxAttempts,
            Ip = ip,
            Ua = ua
        });
    }

    /// <summary>
    /// Loads the latest OTP record for an email (if any).
    /// </summary>
    /// <param name="email">Normalized user email.</param>
    /// <returns>
    /// Tuple containing hash/salt/attempts state, or <c>null</c> if no OTP exists.
    /// </returns>
    public async Task<(byte[] Hash, byte[] Salt, int Attempts, int MaxAttempts, bool IsUsed, DateTime Expires)?>
        GetLatestOtpAsync(string email)
    {
        const string sql = @"
SELECT TOP 1
  CodeHash   AS Hash,
  Salt,
  Attempts,
  MaxAttempts,
  IsUsed,
  ExpiresAtUtc AS Expires
FROM dbo.OtpCodes
WHERE Email = @Email
ORDER BY OtpId DESC;";

        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<
            (byte[] Hash, byte[] Salt, int Attempts, int MaxAttempts, bool IsUsed, DateTime Expires)
        >(sql, new { Email = email });
    }

    /// <summary>
    /// Increments attempt counter for the latest OTP record of an email.
    /// </summary>
    public async Task IncrementOtpAttemptsAsync(string email)
    {
        const string sql = @"
UPDATE dbo.OtpCodes
SET Attempts = Attempts + 1
WHERE OtpId = (
    SELECT TOP 1 OtpId FROM dbo.OtpCodes
    WHERE Email = @Email ORDER BY OtpId DESC
);";
        await using var c = Open();
        await c.ExecuteAsync(sql, new { Email = email });
    }

    /// <summary>
    /// Marks the latest OTP record of an email as used.
    /// </summary>
    public async Task MarkOtpUsedAsync(string email)
    {
        const string sql = @"
UPDATE dbo.OtpCodes
SET IsUsed = 1
WHERE OtpId = (
    SELECT TOP 1 OtpId FROM dbo.OtpCodes
    WHERE Email = @Email ORDER BY OtpId DESC
);";
        await using var c = Open();
        await c.ExecuteAsync(sql, new { Email = email });
    }

    /// <summary>
    /// Generates a 6-digit OTP code as string (000000-999999).
    /// </summary>
    public static string GenerateOtpCode() =>
        RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    /// <summary>
    /// Generates a random 16-byte salt for OTP hashing.
    /// </summary>
    public static byte[] GenerateSalt()
    {
        var s = new byte[16];
        RandomNumberGenerator.Fill(s);
        return s;
    }

    /// <summary>
    /// Hashes an OTP code with a salt using SHA-256.
    /// </summary>
    public static byte[] HashOtp(string code, byte[] salt)
    {
        using var sha = SHA256.Create();
        var c = Encoding.UTF8.GetBytes(code);
        var all = new byte[c.Length + salt.Length];
        Buffer.BlockCopy(c, 0, all, 0, c.Length);
        Buffer.BlockCopy(salt, 0, all, c.Length, salt.Length);
        return sha.ComputeHash(all);
    }
}
