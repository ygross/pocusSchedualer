using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace PocusSchedualer.Services;

public static class AuthHelpers
{
    public static (bool IsAuth, bool IsAdmin, int? MyInstructorId) GetAuthInfo(HttpContext ctx)
    {
        if (ctx.User?.Identity?.IsAuthenticated != true)
            return (false, false, null);

        var role = ctx.User.FindFirstValue(ClaimTypes.Role) ?? "";
        var isAdmin = role.Equals("Admin", StringComparison.OrdinalIgnoreCase);

        int? myId = null;
        var claimVal = ctx.User.FindFirst("instructorId")?.Value;
        if (int.TryParse(claimVal, out var id) && id > 0)
            myId = id;

        return (true, isAdmin, myId);
    }
}
