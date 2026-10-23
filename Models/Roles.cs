public static class Roles
{
    public const string Admin = "Admin";
    public const string CourseManager = "CourseManager";
    public const string Instructor = "Instructor";
    public const string SystemAdmin = "SystemAdmin";

    public const string AnyUser = Admin + "," + CourseManager + "," + Instructor;
}
