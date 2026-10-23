using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace PocusSchedualer.Services;

/// <summary>
/// In-memory cached wrapper around dbo.SystemSettings.
/// Cache TTL: 5 minutes. Call InvalidateCache() after any write.
/// Registered as Singleton in DI.
/// </summary>
public sealed class SettingsService
{
    private readonly Db _db;
    private Dictionary<string, string> _cache = new(StringComparer.OrdinalIgnoreCase);
    private DateTime _cacheExpiry = DateTime.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public SettingsService(Db db) => _db = db;

    public void InvalidateCache() => _cacheExpiry = DateTime.MinValue;

    private async Task<Dictionary<string, string>> GetCacheAsync()
    {
        if (DateTime.UtcNow < _cacheExpiry) return _cache;

        await _lock.WaitAsync();
        try
        {
            if (DateTime.UtcNow < _cacheExpiry) return _cache;
            var all = await _db.GetAllSettingsAsync();
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in all)
                if (s.SettingValue != null) d[s.SettingKey] = s.SettingValue;
            _cache = d;
            _cacheExpiry = DateTime.UtcNow.AddMinutes(5);
        }
        finally { _lock.Release(); }

        return _cache;
    }

    public async Task<string?> GetStringAsync(string key, string? defaultValue = null)
    {
        var cache = await GetCacheAsync();
        return cache.TryGetValue(key, out var v) ? v : defaultValue;
    }

    public async Task<bool> GetBoolAsync(string key, bool defaultValue = false)
    {
        var val = await GetStringAsync(key);
        if (val == null) return defaultValue;
        return val.Trim().ToLowerInvariant() is "true" or "1" or "yes";
    }

    public async Task<int> GetIntAsync(string key, int defaultValue = 0)
    {
        var val = await GetStringAsync(key);
        return int.TryParse(val, out var n) ? n : defaultValue;
    }

    /// <summary>Saves a single setting and invalidates the cache.</summary>
    public async Task SaveAsync(string key, string? value, int? updatedBy)
    {
        await _db.UpsertSettingAsync(key, value, updatedBy);
        InvalidateCache();
    }
}
