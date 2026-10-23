using Microsoft.AspNetCore.Routing;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// Onboarding endpoints (create instructor in PendingApproval status).
/// Routes are relative to /api.
/// </summary>
public static class InstructorOnboardingEndpoints
{
    public static void MapInstructorOnboardingEndpoints(this IEndpointRouteBuilder api)
    {
        // Anyone can submit onboarding; account will be PendingApproval.
        api.MapPost("/instructors/onboard", async (InstructorOnboardRequestDto dto, Db db) =>
        {
            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                return Results.BadRequest(new { ok = false, message = "Missing email" });

            var firstName = (dto.FirstName ?? "").Trim();
            var lastName = (dto.LastName ?? "").Trim();
            if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
                return Results.BadRequest(new { ok = false, message = "Missing name" });

            // Validate role against known roles
            var role = (dto.Role ?? "").Trim();
            role = role switch
            {
                Roles.CourseManager => Roles.CourseManager,
                Roles.Admin => Roles.Admin, // allow but you probably won't use it from UI
                _ => Roles.Instructor
            };

            // If already exists, return current state (no changes)
            var existing = await db.GetInstructorAuthStateByEmailAsync(email);
            if (existing != null)
            {
                return Results.Ok(new
                {
                    ok = true,
                    alreadyExists = true,
                    status = existing.Status,
                    role = existing.RoleName,
                    instructorId = existing.InstructorId
                });
            }

            var id = await db.CreatePendingInstructorAsync(
                email,
                firstName,
                lastName,
                role,
                dto.Phone,
                dto.Department);

            return Results.Ok(new
            {
                ok = true,
                alreadyExists = false,
                status = Db.InstructorStatus_PendingApproval,
                role,
                instructorId = id
            });
        });
    }
}
