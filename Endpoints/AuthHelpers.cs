using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace PocusSchedualer.Endpoints
{
    public static class AuthHelpers
    {
        private static bool IsAdminOrSysAdmin(HttpContext ctx) =>
            ctx.User.IsInRole(Roles.Admin) ||
            ctx.User.IsInRole(Roles.SystemAdmin) ||
            string.Equals(ctx.User.FindFirstValue(ClaimTypes.Role), Roles.Admin, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(ctx.User.FindFirstValue(ClaimTypes.Role), Roles.SystemAdmin, StringComparison.OrdinalIgnoreCase);

        public static (bool isAuth, bool isAdmin, int? myId) GetAuthInfo(HttpContext ctx)
        {
            if (ctx?.User?.Identity?.IsAuthenticated != true)
                return (false, false, null);

            var s =
                ctx.User.FindFirst("instructorId")?.Value ??
                ctx.User.FindFirst("InstructorId")?.Value ??
                ctx.User.FindFirst("myInstructorId")?.Value;

            int? myId = int.TryParse(s, out var id) ? id : null;
            return (true, IsAdminOrSysAdmin(ctx), myId);
        }

        public static (bool isAuth, bool isAdmin, bool isCourseManager, int? myId) GetAuthInfoEx(HttpContext ctx)
        {
            if (ctx?.User?.Identity?.IsAuthenticated != true)
                return (false, false, false, null);

            var isCourseManager =
                ctx.User.IsInRole(Roles.CourseManager) ||
                string.Equals(ctx.User.FindFirstValue(ClaimTypes.Role), Roles.CourseManager, StringComparison.OrdinalIgnoreCase);

            var s =
                ctx.User.FindFirst("instructorId")?.Value ??
                ctx.User.FindFirst("InstructorId")?.Value ??
                ctx.User.FindFirst("myInstructorId")?.Value;

            int? myId = int.TryParse(s, out var id) ? id : null;
            return (true, IsAdminOrSysAdmin(ctx), isCourseManager, myId);
        }
    }
}
