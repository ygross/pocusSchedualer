using System.Text.RegularExpressions;
using PocusSchedualer.Endpoints;

namespace PocusSchedualer.Endpoints;

public static class AdminBulkImportEndpoints
{
    private static readonly HashSet<string> ValidRoles = new(StringComparer.OrdinalIgnoreCase)
        { "Instructor", "CourseManager", "Admin" };

    private static readonly Regex EmailRx = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static void MapAdminBulkImportEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapPost("/instructors/bulk-import", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            if (!ctx.Request.HasFormContentType)
                return Results.BadRequest(new { ok = false, error = "Expected multipart/form-data" });

            var form = await ctx.Request.ReadFormAsync();
            var file = form.Files["file"];
            if (file == null || file.Length == 0)
                return Results.BadRequest(new { ok = false, error = "No file provided" });

            if (file.Length > 2 * 1024 * 1024)
                return Results.BadRequest(new { ok = false, error = "File too large (max 2 MB)" });

            // Parse CSV
            string csvText;
            using (var reader = new StreamReader(file.OpenReadStream()))
                csvText = await reader.ReadToEndAsync();

            // Remove BOM
            csvText = csvText.TrimStart('\uFEFF');

            var lines = csvText
                .Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None)
                .Select(l => l.Trim())
                .Where(l => !string.IsNullOrWhiteSpace(l))
                .ToList();

            if (lines.Count < 2)
                return Results.BadRequest(new { ok = false, error = "File must have a header row and at least one data row" });

            // Parse header
            var headers = ParseCsvLine(lines[0])
                .Select(h => h.Trim().ToLowerInvariant())
                .ToArray();

            int colName  = FindCol(headers, "fullname", "שם מלא", "name", "שם");
            int colEmail = FindCol(headers, "email", "אימייל", "mail");
            int colRole  = FindCol(headers, "role", "תפקיד", "rolename");
            int colDept  = FindCol(headers, "department", "מחלקה", "dept");
            int colPhone = FindCol(headers, "phone", "טלפון", "tel");

            if (colEmail < 0)
                return Results.BadRequest(new { ok = false, error = "Column 'Email' not found in header" });
            if (colName < 0)
                return Results.BadRequest(new { ok = false, error = "Column 'FullName' not found in header" });

            var results = new List<object>();
            int imported = 0, duplicates = 0, errors = 0;

            for (int i = 1; i < lines.Count; i++)
            {
                var cells = ParseCsvLine(lines[i]);
                string Get(int col) => col >= 0 && col < cells.Length ? cells[col].Trim() : "";

                var email    = Get(colEmail).ToLowerInvariant();
                var fullName = Get(colName);
                var role     = Get(colRole);
                var dept     = Get(colDept);
                var phone    = Get(colPhone);

                // Validate
                if (string.IsNullOrWhiteSpace(email))
                { results.Add(Row(i, "", fullName, "error", "Email is empty")); errors++; continue; }

                if (!EmailRx.IsMatch(email))
                { results.Add(Row(i, email, fullName, "error", "Invalid email format")); errors++; continue; }

                if (string.IsNullOrWhiteSpace(fullName))
                { results.Add(Row(i, email, fullName, "error", "FullName is empty")); errors++; continue; }

                if (string.IsNullOrWhiteSpace(role) || !ValidRoles.Contains(role))
                    role = "Instructor";

                try
                {
                    var (inserted, instructorId) = await db.BulkImportInstructorAsync(
                        email, fullName, role,
                        string.IsNullOrWhiteSpace(dept) ? null : dept,
                        string.IsNullOrWhiteSpace(phone) ? null : phone);

                    if (inserted)
                    { results.Add(Row(i, email, fullName, "imported", null, instructorId, role)); imported++; }
                    else
                    { results.Add(Row(i, email, fullName, "duplicate", "Email already exists", instructorId, role)); duplicates++; }
                }
                catch (Exception ex)
                {
                    results.Add(Row(i, email, fullName, "error", ex.Message));
                    errors++;
                }
            }

            return Results.Ok(new
            {
                ok = true,
                total = lines.Count - 1,
                imported,
                duplicates,
                errors,
                rows = results
            });
        });
    }

    private static int FindCol(string[] headers, params string[] names)
    {
        foreach (var n in names)
        {
            var idx = Array.IndexOf(headers, n.ToLowerInvariant());
            if (idx >= 0) return idx;
        }
        return -1;
    }

    private static object Row(int row, string email, string name, string status, string? reason,
        int? instructorId = null, string? role = null)
        => new { row, email, name, status, reason, instructorId, role };

    private static string[] ParseCsvLine(string line)
    {
        var fields = new List<string>();
        bool inQuotes = false;
        var current = new System.Text.StringBuilder();

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                { current.Append('"'); i++; }
                else inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            { fields.Add(current.ToString()); current.Clear(); }
            else current.Append(c);
        }
        fields.Add(current.ToString());
        return fields.ToArray();
    }
}
