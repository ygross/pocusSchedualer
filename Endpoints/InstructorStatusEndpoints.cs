using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Http;

namespace PocusSchedualer.Endpoints;

public static class InstructorStatusEndpoints
{
    // ממופה ל:
    // /simcenter/PocusSchedualer/api/api/pending-approvals/approve
    // /simcenter/PocusSchedualer/api/api/pending-approvals/decline
    public static void MapInstructorStatusEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/api");

        api.MapPost("/pending-approvals/approve", async (Db db, ChangeStatusDto dto) =>
        {
            if (dto == null || dto.InstructorId <= 0)
                return Results.BadRequest(new { ok = false, message = "Invalid instructorId" });

            // ✅ בלי Db.InstructorStatus_*
            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, "Active");
            if (rows == 0)
                return Results.NotFound(new { ok = false });

            return Results.Ok(new { ok = true, status = "Active" });
        });

        api.MapPost("/pending-approvals/decline", async (Db db, ChangeStatusDto dto) =>
        {
            if (dto == null || dto.InstructorId <= 0)
                return Results.BadRequest(new { ok = false, message = "Invalid instructorId" });

            var rows = await db.SetInstructorStatusAsync(dto.InstructorId, "Declined");
            if (rows == 0)
                return Results.NotFound(new { ok = false });

            return Results.Ok(new { ok = true, status = "Declined" });
        });
    }

    public sealed class ChangeStatusDto
    {
        public int InstructorId { get; set; }
    }
}
