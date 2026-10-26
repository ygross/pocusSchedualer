using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

public static class ActorEndpoints
{
    public static void MapActorEndpoints(this IEndpointRouteBuilder api)
    {
        // ── Admin CRUD (/api/admin/actors) ────────────────────────────────────
        var admin = api.MapGroup("/admin/actors");

        admin.MapGet("", async (HttpContext ctx, Db db,
            string? gender, string? ageGroup, string? status) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();
            return Results.Ok(await db.GetActorsAsync(gender, ageGroup, status));
        });

        admin.MapGet("/{actorId:int}", async (HttpContext ctx, int actorId, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();
            var actor = await db.GetActorByIdAsync(actorId);
            return actor is null ? Results.NotFound() : Results.Ok(actor);
        });

        admin.MapPost("", async (HttpContext ctx, ActorUpsertDto dto, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();
            var id = await db.CreateActorAsync(dto);
            return Results.Ok(new { ok = true, actorId = id });
        });

        admin.MapPut("/{actorId:int}", async (HttpContext ctx, int actorId, ActorUpsertDto dto, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();
            var ok = await db.UpdateActorAsync(actorId, dto);
            return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
        });

        admin.MapDelete("/{actorId:int}", async (HttpContext ctx, int actorId, Db db) =>
        {
            var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();
            var ok = await db.DeleteActorAsync(actorId);
            return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
        });

        // ── Availability for a specific instance (admin view) ─────────────────
        // GET /api/admin/activity-instances/{instanceId}/actor-availability
        api.MapGet("/admin/activity-instances/{instanceId:int}/actor-availability",
            async (HttpContext ctx, int instanceId, Db db) =>
            {
                var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin) return Results.Forbid();
                return Results.Ok(await db.GetActorAvailabilityForInstanceAsync(instanceId));
            });

        // ── Actor Assignments (admin) ──────────────────────────────────────────
        // GET /api/admin/activity-instances/{instanceId}/actor-assignments
        api.MapGet("/admin/activity-instances/{instanceId:int}/actor-assignments",
            async (HttpContext ctx, int instanceId, Db db) =>
            {
                var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin) return Results.Forbid();
                return Results.Ok(await db.GetActorAssignmentsForInstanceAsync(instanceId));
            });

        // POST /api/admin/activity-instances/{instanceId}/actor-assignments
        api.MapPost("/admin/activity-instances/{instanceId:int}/actor-assignments",
            async (HttpContext ctx, int instanceId, ActorAssignRequest req, Db db) =>
            {
                var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin) return Results.Forbid();
                var id = await db.AssignActorAsync(instanceId, req.ActorId, req.DecisionNote);
                return Results.Ok(new { ok = true, assignmentId = id });
            });

        // DELETE /api/admin/activity-instances/{instanceId}/actor-assignments/{actorId}
        api.MapDelete("/admin/activity-instances/{instanceId:int}/actor-assignments/{actorId:int}",
            async (HttpContext ctx, int instanceId, int actorId, Db db) =>
            {
                var (isAuth, isAdmin, _) = AuthHelpers.GetAuthInfo(ctx);
                if (!isAuth) return Results.Unauthorized();
                if (!isAdmin) return Results.Forbid();
                var ok = await db.RemoveActorAssignmentAsync(instanceId, actorId);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            });

        // ── Actor self-service availability (/api/actors) ────────────────────
        var actors = api.MapGroup("/actors");

        // GET /api/actors — list all actors (public)
        actors.MapGet("", async (Db db, string? gender, string? ageGroup) =>
            Results.Ok(await db.GetActorsAsync(gender, ageGroup, "active")));

        // GET /api/actors/upcoming-instances — upcoming instances (public)
        actors.MapGet("/upcoming-instances", async (Db db) =>
            Results.Ok(await db.GetUpcomingInstancesAsync()));

        // GET /api/actors/{actorId}/availability — my availability list
        actors.MapGet("/{actorId:int}/availability", async (int actorId, Db db) =>
            Results.Ok(await db.GetMyActorAvailabilityAsync(actorId)));

        // POST /api/actors/{actorId}/activity-instances/{instanceId}/availability
        actors.MapPost("/{actorId:int}/activity-instances/{instanceId:int}/availability",
            async (int actorId, int instanceId, ActorAvailabilitySubmitRequest? req, Db db) =>
            {
                await db.UpsertActorAvailabilityAsync(actorId, instanceId, req?.Note);
                return Results.Ok(new { ok = true });
            });

        // DELETE /api/actors/{actorId}/activity-instances/{instanceId}/availability
        actors.MapDelete("/{actorId:int}/activity-instances/{instanceId:int}/availability",
            async (int actorId, int instanceId, Db db) =>
            {
                var ok = await db.DeleteActorAvailabilityAsync(actorId, instanceId);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            });
    }
}
