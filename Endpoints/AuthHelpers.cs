using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace PocusSchedualer.Endpoints
{
    public static class AuthHelpers
    {
        public static (bool isAuth, bool isAdmin, int? myId) GetAuthInfo(HttpContext ctx)
        {
            if (ctx?.User?.Identity?.IsAuthenticated != true)
                return (false, false, null);

            var isAdmin =
                ctx.User.IsInRole(Roles.Admin) ||
                string.Equals(ctx.User.FindFirstValue(ClaimTypes.Role), Roles.Admin, StringComparison.OrdinalIgnoreCase);

            var s =
                ctx.User.FindFirst("instructorId")?.Value ??
                ctx.User.FindFirst("InstructorId")?.Value ??
                ctx.User.FindFirst("myInstructorId")?.Value;

            int? myId = int.TryParse(s, out var id) ? id : null;
            return (true, isAdmin, myId);
        }

        public static (bool isAuth, bool isAdmin, bool isCourseManager, int? myId) GetAuthInfoEx(HttpContext ctx)
        {
            if (ctx?.User?.Identity?.IsAuthenticated != true)
                return (false, false, false, null);

            var isAdmin =
                ctx.User.IsInRole(Roles.Admin) ||
                string.Equals(ctx.User.FindFirstValue(ClaimTypes.Role), Roles.Admin, StringComparison.OrdinalIgnoreCase);

            var isCourseManager =
                ctx.User.IsInRole(Roles.CourseManager) ||
                string.Equals(ctx.User.FindFirstValue(ClaimTypes.Role), Roles.CourseManager, StringComparison.OrdinalIgnoreCase);

            var s =
                ctx.User.FindFirst("instructorId")?.Value ??
                ctx.User.FindFirst("InstructorId")?.Value ??
                ctx.User.FindFirst("myInstructorId")?.Value;

            int? myId = int.TryParse(s, out var id) ? id : null;
            return (true, isAdmin, isCourseManager, myId);
        }
    }
}
