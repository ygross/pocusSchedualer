namespace PocusSchedualer.Api.Dtos;

/// <summary>
/// LeadsStatus (CourseManager/Admin) - consolidated dashboard DTOs.
/// Designed for a single page that gives the lead an at-a-glance view per course and month.
/// </summary>
public sealed record LeadCourseDto(
    int CourseId,
    string CourseName,
    int ActivityTypeId,
    int ActivitiesCount
);

public sealed record LeadStatusSummaryDto(
    int TotalInstances,
    int CancelledInstances,
    int FullyStaffed,
    int PartiallyStaffed,
    int Unstaffed,
    int TotalRequired,
    int TotalAssigned
);

public sealed record LeadStatusInstanceRowDto(
    int InstanceId,
    int ActivityId,
    string ActivityName,
    DateTime StartUtc,
    DateTime EndUtc,
    int RequiredInstructors,
    int AssignedCount,
    bool IsCancelled,
    string? CancelReason
);

/// <summary>
/// A grouped sent-message entry (EmailOutbox rows grouped by: RelatedId + Subject + Day).
/// Note: EmailOutbox is per-recipient, so we aggregate into one row for the UI.
/// </summary>
public sealed record LeadStatusMessageGroupDto(
    string RelatedEntity,
    string RelatedId,
    DateTime DayUtc,
    string Subject,
    string AggregateStatus,
    int RecipientsCount,
    DateTime? FirstCreatedAtUtc,
    DateTime? LastCreatedAtUtc,
    DateTime? LastSentAtUtc,
    int FailedCount,
    int SentCount,
    int QueuedCount,
    string? AnyBodyHtml
);

public sealed record LeadStatusFairnessRowDto(
    int InstructorId,
    string FullName,
    string? Email,
    int AssignedApproved,
    int AvailabilitySubmitted,
    int OutreachEmails,
    int NotRespondedEstimate
);

public sealed record LeadStatusResponseDto(
    int? EffectiveLeadInstructorId,
    int? SelectedCourseId,
    string Month,
    DateTime FromUtc,
    DateTime ToUtc,
    List<LeadCourseDto> Courses,
    LeadStatusSummaryDto? Summary,
    List<LeadStatusInstanceRowDto> Instances,
    List<LeadStatusMessageGroupDto> Messages,
    List<LeadStatusFairnessRowDto> Fairness
);
