public class ActivityCreateDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }             // ← שמירת קורס פעילה בפועל
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }
    public List<ActivityInstanceDto> Instances { get; set; } = new();
}

public class ActivityInstanceDto
{
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public class ActivityDto
{
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }   // 🔥 הוספה
    public int LeadInstructorId { get; set; }

    public string TypeName { get; set; } = "";       // ← Warning נפתר
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceDto> Instances { get; set; } = new(); // ← Warning נפתר
}

// =======================
// Activity Types DTO
// =======================
public class ActivityTypeDto
{
    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";
}

// =======================
// Course DTO
// =======================
public class CourseDto
{
    public int CourseId { get; set; }
    public string CourseName { get; set; } = "";
    public int ActivityTypeId { get; set; }
}

// =======================
// Instructor DTO
// =======================
public class InstructorDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string? Email { get; set; }

}
 public class ActivityCalendarItemDto
{
    public int ActivityInstanceId { get; set; }   // ✅ חדש – מזהה מופע
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";

    public int CourseId { get; set; }
    public string CourseName { get; set; } = "";

    public int LeadInstructorId { get; set; }
    public string LeadInstructorName { get; set; } = "";

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }

    // אופציונלי (אם כבר קיים אצלך): 
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
    public int AssignedInstructors { get; set; }
    public string? MyStatus { get; set; } // none / proposed / approved
}
public sealed class ActivityEmailHeaderDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";
    public string TypeName { get; set; } = "";
    public string? CourseName { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }
    public string? LeadInstructorEmail { get; set; }
}

public sealed class ActivityEmailInstanceDto
{
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int? RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public class OtpRequestDto
{
    public string Email { get; set; } = "";
}

public class OtpVerifyDto
{
    public string Email { get; set; } = "";
    public string Code { get; set; } = "";
}

public class MeDto
{
    public int InstructorId { get; set; }
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string RoleName { get; set; } = "";
    public string? Department { get; set; }
}
record ImpersonateReq(string Email);    
public class GanttItemDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";

    public int? CourseId { get; set; }
    public string? CourseName { get; set; }

    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }

    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }

    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public record CourseInstructorsPut(List<int> InstructorIds);
// =======================
// Activity Edit / Update DTOs
// =======================

 



public class ActivityForEditDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }

    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceEditDto> Instances { get; set; } = new();
}

public class ActivityUpdateDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceEditDto> Instances { get; set; } = new();
}

public class ActivitySearchResultDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public string TypeName { get; set; } = "";

    public int? CourseId { get; set; }
    public string? CourseName { get; set; }

    public int? LeadInstructorId { get; set; }
    public string? LeadInstructorName { get; set; }

    public DateTime? NextStartUtc { get; set; }
}
public sealed class LeadActivityDetailsDto
{
    public int ActivityId { get; set; }
    public string ActivityName { get; set; } = "";

    public int ActivityTypeId { get; set; }
    public int? CourseId { get; set; }
    public int? LeadInstructorId { get; set; }

    public DateTime? ApplicationDeadlineUtc { get; set; }

    public List<ActivityInstanceWithIdDto> Instances { get; set; } = new();
}

public sealed class ActivityInstanceWithIdDto
{
    public int InstanceId { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}

public sealed class LeadInstanceAvailabilityDto
{
    public int AvailabilityId { get; set; }
    public int InstanceId { get; set; }
    public int InstructorId { get; set; }

    public string FullName { get; set; } = "";
    public string? Email { get; set; }

    public string Status { get; set; } = "";          // Submitted / Approved / Rejected / Requested...
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime? DecisionAtUtc { get; set; }
    public int? DecisionByInstructorId { get; set; }
    public string? DecisionNote { get; set; }

    public int IsAssigned { get; set; }               // 1/0
}
public record ApproveReq(List<int> InstructorIds, string? Note);
public record ReminderReq(bool OnlyNotResponded);
public sealed class FairnessRowDto
{
    public int InstructorId { get; set; }
    public string FullName { get; set; } = "";
    public string? Email { get; set; }
    public int ApprovedInMonth { get; set; }
}
public sealed class DeleteInstanceReq
{
    public string? Reason { get; set; }
}

public sealed class InstanceFairnessDto
{
    public int InstructorId { get; set; }
    public int ApprovedCount { get; set; }
}



public sealed class DeleteActivityReq
{
    public string? Reason { get; set; }
}

public class ActivityInstanceEditDto
{
    public int InstanceId { get; set; }          // ✅ חדש – כדי לעדכן/למחוק מופע ספציפי
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int RoomsCount { get; set; }
    public int RequiredInstructors { get; set; }
}
public class ActivityUpdateHeaderDto
{
    public string ActivityName { get; set; } = "";
    public int ActivityTypeId { get; set; }
    public int CourseId { get; set; }
    public int LeadInstructorId { get; set; }
    public DateTime? ApplicationDeadlineUtc { get; set; }
}
