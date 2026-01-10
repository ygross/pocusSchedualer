using Microsoft.AspNetCore.Builder;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Activities endpoints mapper.
/// Currently empty because endpoints are still defined in Program.cs.
/// This file exists ONLY to satisfy app.MapActivitiesEndpoints().
/// </summary>
public static class ActivitiesEndpoints
{
    public static void MapActivitiesEndpoints(this WebApplication app)
    {
        // intentionally empty
        // later you can move activity endpoints here if you want
    }
}
    