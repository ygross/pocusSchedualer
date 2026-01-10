public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this WebApplication app)
    {
        app.MapGet("/api/health/db", async (Db db) =>
        {
            var ok = await db.IsDbAliveAsync();
            return Results.Ok(new { ok });
        });
    }
}
