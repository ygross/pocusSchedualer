#Requires -Version 7
<#
.SYNOPSIS
  SimPocus Scheduler — E2E Test (Multi-Course / Multi-Activity)
  יצירת מספר קורסים ופעילויות → Lead → בקשות זמינות → אישור מדריכים → שיבוץ
  הערה: אין ניקוי — כל הנתונים נשמרים ב-DB
#>

$ErrorActionPreference = "Stop"
$BaseUrl = "https://localrecord.med.ad.bgu.ac.il/simcenter/PocusSchedualer/api/api"
$ConnStr  = "Server=simsqli.med.ad.bgu.ac.il;Database=SimPocusSched;Encrypt=True;TrustServerCertificate=True;Integrated Security=True;"
$OTP_CODE = "888777"

function OK  ($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function ERR ($m) { Write-Host "  [ERR] $m" -ForegroundColor Red; throw $m }
function STEP($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function INFO($m) { Write-Host "     $m" -ForegroundColor Gray }
function WARN($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }

# ─── SQL scalar ────────────────────────────────────────────────────────
function Sql([string]$sql, [hashtable]$p = @{}) {
    $conn = New-Object System.Data.SqlClient.SqlConnection $ConnStr
    $conn.Open()
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        foreach ($k in $p.Keys) {
            $param = $cmd.CreateParameter()
            $param.ParameterName = "@$k"
            $param.Value = if ($null -eq $p[$k]) { [DBNull]::Value } else { $p[$k] }
            $cmd.Parameters.Add($param) | Out-Null
        }
        return $cmd.ExecuteScalar()
    } finally { $conn.Close() }
}

# Multi-row query — returns array of hashtables
function SqlRows([string]$sql, [hashtable]$p = @{}) {
    $conn = New-Object System.Data.SqlClient.SqlConnection $ConnStr
    $conn.Open()
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        foreach ($k in $p.Keys) {
            $param = $cmd.CreateParameter()
            $param.ParameterName = "@$k"
            $param.Value = if ($null -eq $p[$k]) { [DBNull]::Value } else { $p[$k] }
            $cmd.Parameters.Add($param) | Out-Null
        }
        $reader = $cmd.ExecuteReader()
        $rows = [System.Collections.Generic.List[hashtable]]::new()
        while ($reader.Read()) {
            $row = @{}
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                $row[$reader.GetName($i)] = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) }
            }
            $rows.Add($row)
        }
        return $rows
    } finally { $conn.Close() }
}

# Upsert instructor: insert if not exists, ensure Active, return InstructorId
function UpsertInstructor([string]$email, [string]$name, [string]$role) {
    try {
        Sql @"
IF NOT EXISTS (SELECT 1 FROM dbo.Instructors WHERE Email=@e)
  INSERT INTO dbo.Instructors (Email,FullName,Role,Status,CreatedAtUtc,UpdatedAtUtc)
  VALUES (@e,@n,@r,'Active',SYSUTCDATETIME(),SYSUTCDATETIME())
"@ @{ e=$email; n=$name; r=$role } | Out-Null
    } catch { <# ignore duplicate #> }
    Sql "UPDATE dbo.Instructors SET Status='Active',FullName=@n,UpdatedAtUtc=SYSUTCDATETIME() WHERE Email=@e" @{ e=$email; n=$name } | Out-Null
    return [int](Sql "SELECT InstructorId FROM dbo.Instructors WHERE Email=@e" @{ e=$email })
}

# Upsert ActivityType — return id
function UpsertActivityType([string]$typeName) {
    $id = Sql "SELECT ActivityTypeId FROM dbo.ActivityTypes WHERE TypeName=@n" @{ n=$typeName }
    if (-not $id) {
        $id = Sql "INSERT INTO dbo.ActivityTypes(TypeName) OUTPUT INSERTED.ActivityTypeId VALUES(@n)" @{ n=$typeName }
    }
    return [int]$id
}

# Upsert Course — return id
function UpsertCourse([string]$courseName, [int]$atId) {
    $id = Sql "SELECT CourseId FROM dbo.Courses WHERE CourseName=@n" @{ n=$courseName }
    if (-not $id) {
        $id = Sql "INSERT INTO dbo.Courses(CourseName,ActivityTypeId) OUTPUT INSERTED.CourseId VALUES(@n,@at)" @{ n=$courseName; at=$atId }
    }
    return [int]$id
}

# Link instructor to activity type + course (idempotent)
function LinkInstructor([int]$iid, [int]$atId, [int]$courseId) {
    Sql "IF NOT EXISTS(SELECT 1 FROM dbo.InstructorActivityTypes WHERE InstructorId=@i AND ActivityTypeId=@at) INSERT INTO dbo.InstructorActivityTypes(InstructorId,ActivityTypeId) VALUES(@i,@at)" @{ i=$iid; at=$atId } | Out-Null
    Sql "IF NOT EXISTS(SELECT 1 FROM dbo.InstructorCourses WHERE InstructorId=@i AND CourseId=@c) INSERT INTO dbo.InstructorCourses(InstructorId,CourseId) VALUES(@i,@c)" @{ i=$iid; c=$courseId } | Out-Null
}

# ─── OTP hash (mirrors Db.HashOtp: SHA256(codeBytes + saltBytes)) ──────
function OtpHash([string]$code, [byte[]]$salt) {
    $sha    = [System.Security.Cryptography.SHA256]::Create()
    $cBytes = [System.Text.Encoding]::UTF8.GetBytes($code)
    $all    = [byte[]]::new($cBytes.Length + $salt.Length)
    [Buffer]::BlockCopy($cBytes, 0, $all, 0,             $cBytes.Length)
    [Buffer]::BlockCopy($salt,   0, $all, $cBytes.Length, $salt.Length)
    return $sha.ComputeHash($all)
}

function InsertOtp([string]$email, [string]$code) {
    $salt = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(16)
    $hash = OtpHash $code $salt
    $exp  = (Get-Date).ToUniversalTime().AddMinutes(20)

    $conn = New-Object System.Data.SqlClient.SqlConnection $ConnStr
    $conn.Open()
    try {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
INSERT INTO dbo.OtpCodes
  (Email,CodeHash,Salt,CreatedAtUtc,ExpiresAtUtc,Attempts,MaxAttempts,IsUsed,RequestIp,UserAgent)
VALUES
  (@e,@h,@s,SYSUTCDATETIME(),@exp,0,10,0,'127.0.0.1','e2e-test')
"@
        $cmd.Parameters.Add("@e",   [System.Data.SqlDbType]::NVarChar, 200).Value = [string]$email
        $cmd.Parameters.Add("@h",   [System.Data.SqlDbType]::VarBinary, 64).Value  = [byte[]]$hash
        $cmd.Parameters.Add("@s",   [System.Data.SqlDbType]::VarBinary, 32).Value  = [byte[]]$salt
        $cmd.Parameters.Add("@exp", [System.Data.SqlDbType]::DateTime2).Value      = [datetime]$exp
        $cmd.ExecuteNonQuery() | Out-Null
    } finally { $conn.Close() }
}

# ─── Login: plant OTP → verify → return WebSession ──────────────────────
function DoLogin([string]$email, [string]$code) {
    InsertOtp $email $code
    Start-Sleep -Milliseconds 200
    $r = Invoke-WebRequest `
        -Uri "$BaseUrl/auth/otp/verify" `
        -Method POST `
        -Body (@{ email=$email; code=$code } | ConvertTo-Json) `
        -ContentType "application/json" `
        -SessionVariable sess `
        -SkipCertificateCheck
    $obj = $r.Content | ConvertFrom-Json
    if (-not $obj.ok) { ERR "Login fail [$email]: $($r.Content)" }
    return @{ Session = $sess; Me = $obj.me }
}

# ─── Impersonate via admin session ──────────────────────────────────────
$Script:ImpSession = $null

function StartImpersonate([Microsoft.PowerShell.Commands.WebRequestSession]$adminSess, [int]$targetId) {
    $cloned = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
    $cloned.UserAgent = "e2e-test"
    foreach ($c in $adminSess.Cookies.GetAllCookies()) { $cloned.Cookies.Add($c) }

    $r = Invoke-WebRequest `
        -Uri "$BaseUrl/admin/impersonate/start" `
        -Method POST `
        -Body (@{ instructorId=$targetId } | ConvertTo-Json) `
        -ContentType "application/json" `
        -WebSession $cloned `
        -SkipCertificateCheck
    $obj = $r.Content | ConvertFrom-Json
    if (-not $obj.ok) { ERR "Impersonate $targetId failed: $($r.Content)" }
    $Script:ImpSession = $cloned
    INFO "Impersonating => $($obj.name) [$($obj.role)]"
}

function StopImpersonate {
    if (-not $Script:ImpSession) { return }
    try {
        Invoke-WebRequest `
            -Uri "$BaseUrl/admin/impersonate/stop" `
            -Method POST -Body "{}" `
            -ContentType "application/json" `
            -WebSession $Script:ImpSession `
            -SkipCertificateCheck | Out-Null
    } catch { <# ignore #> }
    $Script:ImpSession = $null
}

function ImpPost([string]$path, [object]$body) {
    try {
        $r = Invoke-WebRequest `
            -Uri "$BaseUrl$path" `
            -Method POST `
            -Body ($body | ConvertTo-Json -Depth 5) `
            -ContentType "application/json" `
            -WebSession $Script:ImpSession `
            -SkipCertificateCheck
        return $r.Content | ConvertFrom-Json
    } catch {
        $errBody = ""
        try { $errBody = $_.ErrorDetails.Message } catch {}
        ERR "POST $path => HTTP $($_.Exception.Response.StatusCode) | $errBody"
    }
}

function ImpGet([string]$path) {
    $r = Invoke-WebRequest `
        -Uri "$BaseUrl$path" `
        -Method GET `
        -WebSession $Script:ImpSession `
        -SkipCertificateCheck
    return $r.Content | ConvertFrom-Json
}

# ─── Full E2E flow for one activity instance ────────────────────────────
# Returns $true on success, $false on failure (non-fatal per-activity)
function RunActivityFlow(
    [Microsoft.PowerShell.Commands.WebRequestSession]$adminSess,
    [string]$label,
    [int]$courseId,
    [int]$atId,
    [int]$leadId,
    [int[]]$instIds,
    [int]$daysAhead,
    [int]$startHour,
    [int]$durationHours,
    [int]$roomsCount,
    [int]$requiredInstructors
) {
    $ts = Get-Date -Format 'HH:mm:ss'

    # ── Create activity + instance (as admin) ────────────────────────────
    $startUtc   = (Get-Date).Date.AddDays($daysAhead).AddHours($startHour).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endUtc     = (Get-Date).Date.AddDays($daysAhead).AddHours($startHour + $durationHours).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $deadline   = (Get-Date).AddDays($daysAhead - 3).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    try {
        $createR = Invoke-WebRequest `
            -Uri "$BaseUrl/activities/create" `
            -Method POST `
            -Body (@{
                activityName           = "$label [$ts]"
                activityTypeId         = $atId
                courseId               = $courseId
                leadInstructorId       = $leadId
                applicationDeadlineUtc = $deadline
                instances = @(@{
                    startUtc            = $startUtc
                    endUtc              = $endUtc
                    roomsCount          = $roomsCount
                    requiredInstructors = $requiredInstructors
                })
            } | ConvertTo-Json -Depth 5) `
            -ContentType "application/json" `
            -WebSession $adminSess `
            -SkipCertificateCheck

        $actObj     = $createR.Content | ConvertFrom-Json
        $activityId = $actObj.activityId
        if (-not $activityId) { ERR "יצירת פעילות נכשלה: $($createR.Content)" }
    } catch {
        WARN "[$label] יצירת פעילות נכשלה: $_"
        return $false
    }

    $instanceId = [int](Sql "SELECT TOP 1 InstanceId FROM dbo.ActivityInstances WHERE ActivityId=@a ORDER BY InstanceId DESC" @{ a=$activityId })
    if (-not $instanceId) { WARN "[$label] לא נמצא מופע"; return $false }
    OK "[$label] Activity=$activityId  Instance=$instanceId  ($startUtc)"

    # ── Lead: request availability ───────────────────────────────────────
    try {
        StartImpersonate $adminSess $leadId
        $remR = ImpPost "/lead/instances/$instanceId/request-availability" @{
            instructorIds = @($instIds | ForEach-Object { [int]$_ })
            sendEmail     = $false
            note          = "E2E $label"
        }
        StopImpersonate
        OK "[$label] בקשות זמינות: inserted=$($remR.inserted)"
    } catch {
        StopImpersonate
        WARN "[$label] request-availability נכשל: $_"
        return $false
    }

    # ── Instructors: submit availability ────────────────────────────────
    foreach ($iid in $instIds) {
        try {
            StartImpersonate $adminSess $iid
            $avR = ImpPost "/instructors/instances/$instanceId/availability" @{}
            StopImpersonate
            OK "[$label] Instructor $iid הציע זמינות: ok=$($avR.ok)"
        } catch {
            StopImpersonate
            WARN "[$label] Instructor $iid — availability נכשל: $_"
        }
    }

    # ── Lead: check availability list ───────────────────────────────────
    try {
        StartImpersonate $adminSess $leadId
        $avList = ImpGet "/lead/instances/$instanceId/availability"
        StopImpersonate
        $avArr = if ($avList -is [array]) { $avList } else { @($avList) }
        INFO "[$label] מגישי זמינות: $($avArr.Count)"
        $avArr | ForEach-Object { INFO "  $($_.fullName ?? $_.FullName) — $($_.status ?? $_.Status)" }
    } catch {
        StopImpersonate
        WARN "[$label] בדיקת זמינות נכשלה: $_"
    }

    # ── Lead: approve assignment (trim list to requiredInstructors) ─────────
    # Only instructors who submitted availability AND count <= required
    $approveIds = @($instIds | Select-Object -First $requiredInstructors | ForEach-Object { [int]$_ })
    try {
        StartImpersonate $adminSess $leadId
        $appR = ImpPost "/lead/instances/$instanceId/approve" @{
            instructorIds = $approveIds
            note          = "E2E approve $label"
            sendEmail     = $false
        }
        StopImpersonate
        if ($appR.ok) { OK "[$label] שיבוץ אושר ✅" }
        else { WARN "[$label] שיבוץ נכשל: $($appR | ConvertTo-Json)" }
    } catch {
        StopImpersonate
        WARN "[$label] approve נכשל: $_"
        return $false
    }

    # ── DB verify ────────────────────────────────────────────────────────
    $assigns = SqlRows @"
SELECT i.FullName, a.Status
FROM dbo.Assignments a
JOIN dbo.Instructors i ON i.InstructorId=a.InstructorId
WHERE a.InstanceId=@inst
"@ @{ inst=$instanceId }

    $assigns | ForEach-Object { OK "[$label] DB Assignment: $($_['FullName']) — $($_['Status'])" }

    return $true
}

# ══════════════════════════════════════════════════════════════════════
# PHASE 0 — DB Setup
# ══════════════════════════════════════════════════════════════════════
STEP "PHASE 0 — DB Setup (משתמשים)"

$adminEmail = "ygross@bgu.ac.il"
$leadEmail  = "lead.e2e@test.local"
$inst1Email = "inst1.e2e@test.local"
$inst2Email = "inst2.e2e@test.local"
$inst3Email = "inst3.e2e@test.local"
$inst4Email = "inst4.e2e@test.local"

$adminId = UpsertInstructor $adminEmail "יוסי גרוס"       "Admin"
$leadId  = UpsertInstructor $leadEmail  "מרכז קורס E2E"   "CourseManager"
$inst1Id = UpsertInstructor $inst1Email "מדריך א E2E"     "Instructor"
$inst2Id = UpsertInstructor $inst2Email "מדריך ב E2E"     "Instructor"
$inst3Id = UpsertInstructor $inst3Email "מדריך ג E2E"     "Instructor"
$inst4Id = UpsertInstructor $inst4Email "מדריך ד E2E"     "Instructor"

OK "Admin=$adminId  Lead=$leadId  Inst1=$inst1Id  Inst2=$inst2Id  Inst3=$inst3Id  Inst4=$inst4Id"

# ── Define courses & activity types ────────────────────────────────────
STEP "PHASE 0b — קורסים וסוגי פעילויות"

$courses = @(
    @{ Name="POCUS — Basic"; TypeName="POCUS Basic";    Instructors=@($inst1Id,$inst2Id) }
    @{ Name="POCUS — Advanced"; TypeName="POCUS Advanced"; Instructors=@($inst1Id,$inst3Id) }
    @{ Name="Emergency US"; TypeName="Emergency Ultrasound"; Instructors=@($inst2Id,$inst3Id,$inst4Id) }
    @{ Name="Cardiac Echo Intro"; TypeName="Cardiac Echo"; Instructors=@($inst1Id,$inst4Id) }
)

foreach ($c in $courses) {
    $atId     = UpsertActivityType $c.TypeName
    $courseId = UpsertCourse       $c.Name $atId
    $c['AtId']     = $atId
    $c['CourseId'] = $courseId
    foreach ($iid in (@($leadId) + $c.Instructors)) {
        LinkInstructor $iid $atId $courseId
    }
    OK "$($c.Name)  (CourseId=$courseId  AtId=$atId)"
}

# ══════════════════════════════════════════════════════════════════════
# PHASE 1 — Admin Login
# ══════════════════════════════════════════════════════════════════════
STEP "PHASE 1 — Admin Login"

$admin    = DoLogin $adminEmail $OTP_CODE
$adminSess = $admin.Session
OK "Admin: $($admin.Me.fullName) / $($admin.Me.roleName)"

# ══════════════════════════════════════════════════════════════════════
# PHASE 2-7 — Activity flows (per course × per activity)
# ══════════════════════════════════════════════════════════════════════

# Test matrix: each entry describes one activity to create + run
# daysAhead / startHour / duration / rooms / required
$testMatrix = @(
    # Course 0 — POCUS Basic (2 activities)
    @{ CourseIdx=0; Label="POCUS Basic — Session A"; DaysAhead=7;  StartHour=8;  Duration=2; Rooms=2; Required=2 }
    @{ CourseIdx=0; Label="POCUS Basic — Session B"; DaysAhead=14; StartHour=13; Duration=3; Rooms=2; Required=2 }

    # Course 1 — POCUS Advanced (2 activities)
    @{ CourseIdx=1; Label="POCUS Advanced — Morning"; DaysAhead=10; StartHour=9;  Duration=4; Rooms=3; Required=2 }
    @{ CourseIdx=1; Label="POCUS Advanced — Afternoon"; DaysAhead=21; StartHour=14; Duration=2; Rooms=1; Required=1 }

    # Course 2 — Emergency US (3 activities)
    @{ CourseIdx=2; Label="Emergency US — Intro";    DaysAhead=5;  StartHour=8;  Duration=3; Rooms=2; Required=3 }
    @{ CourseIdx=2; Label="Emergency US — Advanced"; DaysAhead=12; StartHour=10; Duration=4; Rooms=2; Required=2 }
    @{ CourseIdx=2; Label="Emergency US — Practicum"; DaysAhead=28; StartHour=9;  Duration=5; Rooms=3; Required=3 }

    # Course 3 — Cardiac Echo (2 activities)
    @{ CourseIdx=3; Label="Cardiac Echo — Basics";  DaysAhead=8;  StartHour=11; Duration=3; Rooms=1; Required=2 }
    @{ CourseIdx=3; Label="Cardiac Echo — Clinical"; DaysAhead=18; StartHour=9;  Duration=4; Rooms=2; Required=2 }
)

$passed = 0
$failed = 0

foreach ($tc in $testMatrix) {
    $c       = $courses[$tc.CourseIdx]
    STEP "Activity Flow — $($tc.Label)"

    $ok = RunActivityFlow `
        -adminSess          $adminSess `
        -label              $tc.Label `
        -courseId           $c.CourseId `
        -atId               $c.AtId `
        -leadId             $leadId `
        -instIds            $c.Instructors `
        -daysAhead          $tc.DaysAhead `
        -startHour          $tc.StartHour `
        -durationHours      $tc.Duration `
        -roomsCount         $tc.Rooms `
        -requiredInstructors $tc.Required

    if ($ok) { $passed++ } else { $failed++ }
}

# ══════════════════════════════════════════════════════════════════════
# PHASE 8 — Lead Dashboard per course (last active month)
# ══════════════════════════════════════════════════════════════════════
STEP "PHASE 8 — Lead Dashboard סיכום לפי קורס"

$month = (Get-Date).AddDays(14).ToString("yyyy-MM")
StartImpersonate $adminSess $leadId

foreach ($c in $courses) {
    try {
        $dash = ImpGet "/lead/status?courseId=$($c.CourseId)&month=$month"
        $s = $dash.summary
        INFO "$($c.Name): totalInstances=$($s.totalInstances)  fullyStaffed=$($s.fullyStaffed)  partial=$($s.partiallyStaffed)  unstaffed=$($s.unstaffed)"
    } catch {
        WARN "$($c.Name): dashboard error — $_"
    }
}

StopImpersonate

# ══════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "   E2E MULTI-COURSE TEST COMPLETE       " -ForegroundColor Magenta
Write-Host "   פעילויות עברו: $passed   נכשלו: $failed" -ForegroundColor $(if($failed -eq 0){"Magenta"}else{"Yellow"})
Write-Host "   נתוני הבדיקה נשמרו ב-DB (ללא ניקוי) " -ForegroundColor Magenta
Write-Host "════════════════════════════════════════" -ForegroundColor Magenta
