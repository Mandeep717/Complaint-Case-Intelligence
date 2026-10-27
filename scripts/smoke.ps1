$ErrorActionPreference = 'Stop'
$base = if ($env:PS26264_API_BASE) { $env:PS26264_API_BASE.TrimEnd('/') } else { 'http://localhost:4000/api/v1' }

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw "FAIL: $message" }
  Write-Host "PASS: $message"
}

$health = Invoke-RestMethod -Uri "$base/health"
Assert-True ($health.ok -eq $true) 'API health endpoint responds'

$reviewer = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body (@{
  email = 'reviewer@demo.aicte.local'; password = 'Demo@26264'
} | ConvertTo-Json)
$reviewHeaders = @{ Authorization = "Bearer $($reviewer.token)" }
Assert-True ($reviewer.user.role -eq 'reviewer') 'reviewer can authenticate'

$dashboard = Invoke-RestMethod -Uri "$base/dashboard/summary" -Headers $reviewHeaders
$complaints = Invoke-RestMethod -Uri "$base/complaints" -Headers $reviewHeaders
$institutions = Invoke-RestMethod -Uri "$base/institutions" -Headers $reviewHeaders
$overlaps = Invoke-RestMethod -Uri "$base/overlaps" -Headers $reviewHeaders
Assert-True ($dashboard.total -ge 1 -and $dashboard.total -eq $complaints.total) 'dashboard totals match persisted complaint records'
Assert-True ($institutions.items.Count -ge 1) 'institution registry returns persisted institutions'
Assert-True ($overlaps.items.Count -ge 1) 'reviewer can see the seeded overlap queue'

$search = Invoke-RestMethod -Method Post -Uri "$base/search/complaints" -Headers $reviewHeaders -ContentType 'application/json' -Body (@{
  query = 'graduates degree certificate delay'; mode = 'semantic'
} | ConvertTo-Json)
Assert-True ($search.mode -eq 'keyword_fallback' -and $search.notice -match 'Embedding provider is not configured') 'semantic mode labels keyword fallback when embeddings are unavailable'

$officer = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body (@{
  email = 'officer.pgrc@demo.aicte.local'; password = 'Demo@26264'
} | ConvertTo-Json)
$deniedStatus = 0
try { Invoke-RestMethod -Uri "$base/overlaps" -Headers @{ Authorization = "Bearer $($officer.token)" } | Out-Null }
catch { $deniedStatus = [int]$_.Exception.Response.StatusCode.value__ }
Assert-True ($deniedStatus -eq 403) 'bureau officer is denied access to the cross-bureau review queue'

Invoke-RestMethod -Method Post -Uri "$base/auth/logout" -Headers $reviewHeaders | Out-Null
$revokedStatus = 0
try { Invoke-RestMethod -Uri "$base/auth/me" -Headers $reviewHeaders | Out-Null }
catch { $revokedStatus = [int]$_.Exception.Response.StatusCode.value__ }
Assert-True ($revokedStatus -eq 401) 'logout revokes the bearer token'

Write-Host 'Smoke checks passed.'
