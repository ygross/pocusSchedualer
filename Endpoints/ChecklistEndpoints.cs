using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// REST endpoints for the Checklists feature.
/// All routes are relative to the /api/admin group.
/// </summary>
public static class ChecklistEndpoints
{
    public static void MapChecklistEndpoints(this IEndpointRouteBuilder admin)
    {
        // ── Checklist CRUD ───────────────────────────────────────────────────

        // GET /api/admin/checklists
        admin.MapGet("/checklists", async (HttpContext ctx, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            try { return Results.Ok(await db.GetChecklistsAsync()); }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // GET /api/admin/checklists/{id}
        admin.MapGet("/checklists/{id:int}", async (HttpContext ctx, int id, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            try
            {
                var detail = await db.GetChecklistDetailAsync(id);
                return detail is null ? Results.NotFound() : Results.Ok(detail);
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // POST /api/admin/checklists
        admin.MapPost("/checklists", async (HttpContext ctx, ChecklistUpsertDto dto, Db db) =>
        {
            var (isAuth, isAdmin, isCM, myId) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(dto?.Title))
                return Results.BadRequest(new { ok = false, error = "Title required" });

            try
            {
                var id = await db.CreateChecklistAsync(dto.Title.Trim(), dto.Description?.Trim(), myId);
                return Results.Ok(new { ok = true, checklistId = id });
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // PUT /api/admin/checklists/{id}
        admin.MapPut("/checklists/{id:int}", async (HttpContext ctx, int id, ChecklistUpsertDto dto, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(dto?.Title))
                return Results.BadRequest(new { ok = false, error = "Title required" });

            try
            {
                var ok = await db.UpdateChecklistAsync(id, dto.Title.Trim(), dto.Description?.Trim());
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // DELETE /api/admin/checklists/{id}
        admin.MapDelete("/checklists/{id:int}", async (HttpContext ctx, int id, Db db) =>
        {
            var (isAuth, isAdmin, _, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            try
            {
                var ok = await db.DeleteChecklistAsync(id);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // ── Items ────────────────────────────────────────────────────────────

        // POST /api/admin/checklists/{id}/items
        admin.MapPost("/checklists/{id:int}/items", async (
            HttpContext ctx, int id, ChecklistItemUpsertDto dto, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(dto?.ItemText))
                return Results.BadRequest(new { ok = false, error = "ItemText required" });

            try
            {
                var itemId = await db.AddChecklistItemAsync(id, dto.ItemText.Trim(), dto.SortOrder);
                return Results.Ok(new { ok = true, itemId });
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // PUT /api/admin/checklists/{id}/items/{itemId}
        admin.MapPut("/checklists/{id:int}/items/{itemId:int}", async (
            HttpContext ctx, int id, int itemId, ChecklistItemUpsertDto dto, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(dto?.ItemText))
                return Results.BadRequest(new { ok = false, error = "ItemText required" });

            try
            {
                var ok = await db.UpdateChecklistItemAsync(itemId, dto.ItemText.Trim(), dto.SortOrder);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // DELETE /api/admin/checklists/{id}/items/{itemId}
        admin.MapDelete("/checklists/{id:int}/items/{itemId:int}", async (
            HttpContext ctx, int id, int itemId, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            try
            {
                var ok = await db.DeleteChecklistItemAsync(itemId);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // ── Course Assignments ────────────────────────────────────────────────

        // POST /api/admin/checklists/{id}/courses/{courseId}
        admin.MapPost("/checklists/{id:int}/courses/{courseId:int}", async (
            HttpContext ctx, int id, int courseId, Db db) =>
        {
            var (isAuth, isAdmin, isCM, myId) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            try
            {
                var (ok, linkId, error) = await db.AssignChecklistToCourseAsync(id, courseId, myId);
                if (!ok) return Results.BadRequest(new { ok = false, error });
                return Results.Ok(new { ok = true, linkId });
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // DELETE /api/admin/checklists/links/{linkId}
        admin.MapDelete("/checklists/links/{linkId:int}", async (
            HttpContext ctx, int linkId, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            try
            {
                var ok = await db.UnassignChecklistFromCourseAsync(linkId);
                return ok ? Results.Ok(new { ok = true }) : Results.NotFound();
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // ── Progress ─────────────────────────────────────────────────────────

        // GET /api/admin/checklists/links/{linkId}/progress
        admin.MapGet("/checklists/links/{linkId:int}/progress", async (
            HttpContext ctx, int linkId, Db db) =>
        {
            var (isAuth, isAdmin, isCM, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();

            try { return Results.Ok(await db.GetProgressAsync(linkId)); }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // PUT /api/admin/checklists/links/{linkId}/progress/{itemId}
        admin.MapPut("/checklists/links/{linkId:int}/progress/{itemId:int}", async (
            HttpContext ctx, int linkId, int itemId, ChecklistToggleDto dto, Db db) =>
        {
            var (isAuth, isAdmin, isCM, myId) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && !isCM) return Results.Forbid();
            if (dto is null) return Results.BadRequest(new { ok = false, error = "Body required" });

            try
            {
                await db.ToggleProgressAsync(linkId, itemId, dto.IsChecked, myId);
                return Results.Ok(new { ok = true });
            }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });

        // ── Reminder log (read-only admin view) ───────────────────────────────

        // GET /api/admin/reminder-log?days=30
        admin.MapGet("/reminder-log", async (HttpContext ctx, Db db, int days = 14) =>
        {
            var (isAuth, isAdmin, _, _) = AuthHelpers.GetAuthInfoEx(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin) return Results.Forbid();

            try { return Results.Ok(await db.GetReminderLogAsync(days)); }
            catch { return Results.Problem("An error occurred", statusCode: 500); }
        });
    }
}
