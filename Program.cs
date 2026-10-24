using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using PocusSchedualer.Endpoints;
using PocusSchedualer.Services;

var builder = WebApplication.CreateBuilder(args);

// ============================
// Services (DI)
// ============================
var keysDir = new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "keys"));
keysDir.Create();
builder.Services.AddDataProtection().PersistKeysToFileSystem(keysDir);

builder.Services.AddSingleton<Db>();
builder.Services.Configure<GreenApiOptions>(builder.Configuration.GetSection("GreenApi"));
builder.Services.AddHttpClient<GreenApiWhatsAppService>();
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "SimPocusAuth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.None; // switch to Always when fully HTTPS
        options.Cookie.SameSite = SameSiteMode.Lax;
        // Return HTTP status codes for API calls instead of browser redirects
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
        options.Events.OnRedirectToLogin        = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireRole(Roles.Admin));
    options.AddPolicy("SysAdminOnly", p => p.RequireRole(Roles.SystemAdmin));
    options.AddPolicy("CourseManagerOnly", p => p.RequireRole(Roles.CourseManager));
    options.AddPolicy("InstructorOnly", p => p.RequireRole(Roles.Instructor));
    options.AddPolicy("AnyUser", p => p.RequireRole(Roles.Admin, Roles.CourseManager, Roles.Instructor));
});

builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddHostedService<ReminderBackgroundService>();

// ============================
// App
// ============================
var app = builder.Build();

// DB migrations (separate try so seed always runs)
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
try { var mDb = app.Services.GetRequiredService<Db>(); await mDb.RunMigrationsAsync(); }
catch (Exception ex) { startupLogger.LogCritical(ex, "DB migrations failed on startup — schema may be outdated"); }
// Startup seed: ensure sysadmin record exists
try { var sDb = app.Services.GetRequiredService<Db>(); await sDb.EnsureSysAdminSeedAsync(); }
catch (Exception ex) { startupLogger.LogError(ex, "SysAdmin seed failed"); }

// Static files served BEFORE auth so HTML/JS/CSS never require a valid session
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// ============================
// API group: /api
// ============================
var api = app.MapGroup("/api");

// Endpoints (all routes inside are RELATIVE to /api)
api.MapHealthEndpoints();
api.MapAuthEndpoints();
api.MapActivitiesEndpoints();
api.MapLeadEndpoints();
api.MapAvailabilityEndpoints();
api.MapInstructorAvailabilityEndpoints();
api.MapInstructorCertEndpoints();
api.MapInstructorStatsEndpoints();
api.MapInstructorCoursesEndpoints();
api.MapInstructorsMessagesEndpoints();
api.MapLeadCalendarEndpoints();
api.MapLeadCalendarReminderEndpoints();
api.MapLeadCalendarWhatsAppEndpoints();
api.MapInstructorOnboardingEndpoints();
api.MapBugReportEndpoints();
api.MapAvailabilityRequestEndpoints();
api.MapInstructorCancellationEndpoints();

// SysAdmin group: /api/sysadmin
var sysadmin = api.MapGroup("/sysadmin");
sysadmin.MapSysAdminEndpoints();

// Admin group: /api/admin
var admin = api.MapGroup("/admin");
admin.MapAdminEndpoints();
admin.MapAdminCourseInstructorsEndpoints();
admin.MapAdminCoursesEndpoints();
admin.MapAdminHoursReportEndpoints();
admin.MapAdminPendingApprovalsEndpoints();
admin.MapAdminImpersonateEndpoints();
admin.MapSettingsEndpoints();
admin.MapAdminCenterEndpoints();
admin.MapAdminBulkImportEndpoints();
admin.MapChecklistEndpoints();

api.MapInstructorStatusEndpoints();
api.MapLeadStatusEndpoints();

app.Run();
