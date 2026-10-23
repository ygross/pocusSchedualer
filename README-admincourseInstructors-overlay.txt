Overlay package for admincourseInstructors
=========================================

Includes:
- Program.cs mapping for:
  - admin.MapAdminPendingApprovalsEndpoints()
  - admin.MapAdminCourseInstructorsEndpoints()
- Data/Db.AdminCourseInstructors.cs
- Models/Dtos/AdminCourseInstructorsDtos.cs
- Endpoints/AdminCourseInstructorsEndpoints.cs
- wwwroot/admincourseInstructors.html
- wwwroot/js/admincourseInstructors.js
- wwwroot/css/admincourseInstructors.css
- wwwroot/help.html (removes requireUser crash)
- wwwroot/js/app.js (API fallback for /api and /api/api)

Deploy steps:
1. Paste over project root.
2. Build.
3. Publish to IIS.
4. Restart site/app pool.
