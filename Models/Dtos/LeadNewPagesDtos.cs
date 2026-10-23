using System;

// ── LeadPendingAvailability ────────────────────────────────
public class LeadPendingAvailDto
{
    public int    ActivityId         { get; set; }
    public string ActivityName       { get; set; } = "";
    public int    InstanceId         { get; set; }
    public DateTime StartUtc         { get; set; }
    public DateTime EndUtc           { get; set; }
    public int    RequiredInstructors{ get; set; }
    public int    TotalRequested     { get; set; }
    public int    StillPending       { get; set; }
    public int    Responded          { get; set; }
    public int    Declined           { get; set; }
}

// ── LeadReplacementManagement ─────────────────────────────
public class LeadNeedsAttentionDto
{
    public int    ActivityId          { get; set; }
    public string ActivityName        { get; set; } = "";
    public int    InstanceId          { get; set; }
    public DateTime StartUtc          { get; set; }
    public DateTime EndUtc            { get; set; }
    public int    RequiredInstructors { get; set; }
    public int    AssignedCount       { get; set; }
    public int    AvailableCount      { get; set; }
    public int    RecentCancellations { get; set; }
}

// ── LeadConflictReport ────────────────────────────────────
public class LeadConflictDto
{
    public int    InstructorId { get; set; }
    public string FullName     { get; set; } = "";
    public string Activity1    { get; set; } = "";
    public int    InstanceId1  { get; set; }
    public DateTime Start1     { get; set; }
    public DateTime End1       { get; set; }
    public string Activity2    { get; set; } = "";
    public int    InstanceId2  { get; set; }
    public DateTime Start2     { get; set; }
    public DateTime End2       { get; set; }
}
