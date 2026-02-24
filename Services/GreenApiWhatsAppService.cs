using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace PocusSchedualer.Services;

public sealed class GreenApiOptions
{
    public string ApiUrl { get; set; } = "https://api.green-api.com";
    public string IdInstance { get; set; } = "";
    public string ApiTokenInstance { get; set; } = "";
    public bool Enabled { get; set; } = true;
}

public sealed class GreenApiWhatsAppService
{
    private readonly HttpClient _http;
    private readonly GreenApiOptions _opt;

    public GreenApiWhatsAppService(HttpClient http, IOptions<GreenApiOptions> opt)
    {
        _http = http;
        _opt = opt.Value;
    }

    public bool IsEnabled => _opt.Enabled
        && !string.IsNullOrWhiteSpace(_opt.IdInstance)
        && !string.IsNullOrWhiteSpace(_opt.ApiTokenInstance);

    public async Task SendTextAsync(string chatId, string message, CancellationToken ct = default)
    {
        if (!IsEnabled) throw new InvalidOperationException("GreenApi is disabled or not configured.");

        var url = $"{_opt.ApiUrl.TrimEnd('/')}/waInstance{_opt.IdInstance}/sendMessage/{_opt.ApiTokenInstance}";
        var payload = new { chatId, message };

        using var resp = await _http.PostAsJsonAsync(url, payload, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"GREEN-API sendMessage failed: {(int)resp.StatusCode} {resp.ReasonPhrase}. {body}");
        }
    }
}
