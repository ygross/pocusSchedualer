using PocusSchedualer.Data;

namespace PocusSchedualer.Endpoints;

public static class AdminHoursReportEndpoints
{
    public static IEndpointRouteBuilder MapAdminHoursReportEndpoints(this IEndpointRouteBuilder admin)
    {
        admin.MapGet("/hours-report", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            await using var conn = db.Open();
            var rows = await DbAdminHoursReport.GetAsync(conn);
            return Results.Ok(rows);
        });

        return admin;
    }
}
