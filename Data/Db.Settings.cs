using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

public sealed class SettingDto
{
    public string SettingKey    { get; set; } = "";
    public string? SettingValue { get; set; }
    public string Category      { get; set; } = "";
    public string DisplayName   { get; set; } = "";
    public string? Description  { get; set; }
    public string SettingType   { get; set; } = "string";
    public DateTime UpdatedAtUtc { get; set; }
    public int? UpdatedByInstructorId { get; set; }
}

/// <summary>
/// System settings: key-value store in dbo.SystemSettings.
/// Table is auto-created with defaults on first call.
/// </summary>
public sealed partial class Db
{
    static readonly (string Key, string Value, string Category, string DisplayName, string Description, string Type)[] _settingDefaults =
    {
        ("Email.Enabled",                    "true",  "Email",        "Enable email sending",               "Send automated emails from the system",                         "bool"),
        ("Email.SendAvailabilityRequests",   "true",  "Email",        "Availability request emails",         "Send email to instructors when requesting availability",         "bool"),
        ("Email.SendLeadNotifications",      "true",  "Email",        "Lead notification emails",            "Notify the lead instructor when an instructor responds",         "bool"),
        ("Email.SendAssignmentNotifications","true",  "Email",        "Assignment confirmation emails",       "Send confirmation email to instructor after assignment",         "bool"),
        ("WhatsApp.Enabled",                 "false", "WhatsApp",     "Enable WhatsApp",                     "Send WhatsApp messages via Green API",                          "bool"),
        ("WhatsApp.SendAvailabilityRequests","false", "WhatsApp",     "Availability request WhatsApp",       "Send WhatsApp message when requesting availability",             "bool"),
        ("WhatsApp.SendLeadNotifications",   "false", "WhatsApp",     "Lead response WhatsApp",              "Send WhatsApp to lead when instructor responds",                 "bool"),
        ("Availability.EnforceDeadline",     "false", "Availability", "Enforce submission deadline",         "Block availability submissions after the activity deadline",     "bool"),
        ("Availability.DefaultDeadlineDays", "3",     "Availability", "Default deadline (days before event)","Days before the event that instructors can submit availability", "int"),
        ("Cancellation.AllowInstructorCancel","true", "Cancellation", "Allow instructor self-cancellation",  "Instructor can cancel their own assignment before the event",    "bool"),
        ("System.BaseUrl",                   "",      "System",       "System base URL",                     "Base URL for email links. Leave empty to auto-detect from request", "string"),
    };

    /// <summary>
    /// Ensures dbo.SystemSettings exists and is seeded, then returns all settings.
    /// </summary>
    public async Task<IEnumerable<SettingDto>> GetAllSettingsAsync()
    {
        await EnsureSettingsTableAsync();
        const string sql = "SELECT * FROM dbo.SystemSettings ORDER BY Category, SettingKey;";
        await using var c = Open();
        return await c.QueryAsync<SettingDto>(sql);
    }

    /// <summary>Returns a single setting value, or null if not found.</summary>
    public async Task<string?> GetSettingValueAsync(string key)
    {
        await EnsureSettingsTableAsync();
        const string sql = "SELECT SettingValue FROM dbo.SystemSettings WHERE SettingKey = @key;";
        await using var c = Open();
        return await c.ExecuteScalarAsync<string?>(sql, new { key });
    }

    /// <summary>Upserts a setting value.</summary>
    public async Task UpsertSettingAsync(string key, string? value, int? updatedBy)
    {
        await EnsureSettingsTableAsync();
        const string sql = @"
IF EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = @key)
    UPDATE dbo.SystemSettings
    SET SettingValue = @value, UpdatedAtUtc = SYSUTCDATETIME(), UpdatedByInstructorId = @updatedBy
    WHERE SettingKey = @key;
ELSE
    INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, Category, DisplayName, Description, SettingType)
    VALUES (@key, @value, 'General', @key, NULL, 'string');";
        await using var c = Open();
        await c.ExecuteAsync(sql, new { key, value, updatedBy });
    }

    private bool _settingsTableReady;

    private async Task EnsureSettingsTableAsync()
    {
        if (_settingsTableReady) return;

        await using var c = Open();

        // Create table if missing
        await c.ExecuteAsync(@"
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='SystemSettings'
)
BEGIN
    CREATE TABLE dbo.SystemSettings (
        SettingKey              nvarchar(100)   NOT NULL PRIMARY KEY,
        SettingValue            nvarchar(max)   NULL,
        Category                nvarchar(50)    NOT NULL DEFAULT 'General',
        DisplayName             nvarchar(200)   NOT NULL DEFAULT '',
        Description             nvarchar(500)   NULL,
        SettingType             nvarchar(20)    NOT NULL DEFAULT 'string',
        UpdatedAtUtc            datetime2       NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedByInstructorId   int             NULL
    );
END");

        // Seed defaults — insert if missing, always refresh display metadata
        foreach (var (key, val, cat, display, desc, type) in _settingDefaults)
        {
            await c.ExecuteAsync(@"
IF NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = @key)
    INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, Category, DisplayName, Description, SettingType)
    VALUES (@key, @val, @cat, @display, @desc, @type);
ELSE
    UPDATE dbo.SystemSettings
    SET Category=@cat, DisplayName=@display, Description=@desc, SettingType=@type
    WHERE SettingKey=@key;",
                new { key, val, cat, display, desc, type });
        }

        _settingsTableReady = true;
    }
}
