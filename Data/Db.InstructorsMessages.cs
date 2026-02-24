using Dapper;

public sealed partial class Db
{
    public sealed record InstructorMessageRow(
        long EmailId,
        string ToEmail,
        string Subject,
        string Status,
        DateTime CreatedAtUtc,
        DateTime? SentAtUtc,
        string? FailReason,
        string? RelatedEntity,
        string? RelatedId,
        string BodyHtml          // ✅ חדש – גוף ההודעה
    );

    /// <summary>
    /// מחזיר מיילים שנשלחו למייל של מדריך, בטווח חודשים:
    /// מהחודש שנבחר (year/month) אחורה N חודשים (כולל).
    /// מסנן מיילי OTP לפי Subject/RelatedEntity/BodyHtml.
    /// </summary>
    public async Task<List<InstructorMessageRow>> GetInstructorMessagesAsync(
        string instructorEmail,
        int fromYear,
        int fromMonth,
        int monthsBack
    )
    {
        monthsBack = Math.Clamp(monthsBack, 1, 24);

        var fromStart = new DateTime(fromYear, fromMonth, 1, 0, 0, 0, DateTimeKind.Utc);
        var rangeStart = fromStart.AddMonths(-(monthsBack - 1));
        var rangeEndExclusive = fromStart.AddMonths(1);

        const string sql = @"
SELECT
    eo.EmailId,
    eo.ToEmail,
    eo.Subject,
    eo.Status,
    eo.CreatedAtUtc,
    eo.SentAtUtc,
    eo.FailReason,
    eo.RelatedEntity,
    eo.RelatedId,
    eo.BodyHtml              -- ✅ החזרנו את גוף ההודעה
FROM dbo.EmailOutbox eo
WHERE
    LOWER(eo.ToEmail) = LOWER(@ToEmail)
    AND eo.CreatedAtUtc >= @RangeStartUtc
    AND eo.CreatedAtUtc <  @RangeEndUtc

    -- סינון OTP
    AND (eo.RelatedEntity IS NULL OR eo.RelatedEntity NOT IN ('Otp','OtpCodes','OtpCode','AuthOtp'))
    AND (eo.Subject IS NULL 
         OR eo.Subject NOT LIKE '%OTP%' 
         AND eo.Subject NOT LIKE '%קוד%' 
         AND eo.Subject NOT LIKE '%חד פעמי%')
    AND (eo.BodyHtml IS NULL 
         OR eo.BodyHtml NOT LIKE '%OTP%' 
         AND eo.BodyHtml NOT LIKE '%קוד חד%' 
         AND eo.BodyHtml NOT LIKE '%one-time%')

ORDER BY eo.CreatedAtUtc DESC;
";

        await using var con = Open();
        var rows = await con.QueryAsync<InstructorMessageRow>(sql, new
        {
            ToEmail = instructorEmail.Trim(),
            RangeStartUtc = rangeStart,
            RangeEndUtc = rangeEndExclusive
        });

        return rows.ToList();
    }
}
