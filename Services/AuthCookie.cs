using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

public sealed class AuthCookie
{
    public async Task SignInAsync(HttpContext ctx, int instructorId, string email, string fullName, string role)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, instructorId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Name, fullName),
            new Claim("role", role)
        };

        var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        await ctx.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(id),
            new AuthenticationProperties { IsPersistent = true }
        );
    }

    public async Task SignOutAsync(HttpContext ctx)
        => await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
}
