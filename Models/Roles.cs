public static class Roles
{
    public const string Admin = "Admin";
    public const string CourseManager = "CourseManager";
    public const string Instructor = "Instructor";

    // עוזר לפוליסי “מי נחשב משתמש מערכת”
    public const string AnyUser = Admin + "," + CourseManager + "," + Instructor;
}
