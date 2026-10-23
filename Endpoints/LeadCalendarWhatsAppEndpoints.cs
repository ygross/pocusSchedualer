using Microsoft.AspNetCore.Routing;
using PocusSchedualer.Dtos;

namespace PocusSchedualer.Endpoints;

/// <summary>
/// LeadCalendar WhatsApp endpoints. Routes are relative to /api.
/// </summary>
public static class LeadCalendarWhatsAppEndpoints
{
    public static void MapLeadCalendarWhatsAppEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapPost("/leadcalendar/instances/{instanceId:int}/send-whatsapp", (
            HttpContext ctx,
            int instanceId,
            LeadCalendarSendWhatsAppDto dto,
            Db db) =>
        {
            var (isAuth, isAdmin, myId) = AuthHelpers.GetAuthInfo(ctx);
            if (!isAuth) return Results.Unauthorized();
            if (!isAdmin && myId == null) return Results.Forbid();

            return Results.StatusCode(501); // Not implemented yet
        });
    }
}
