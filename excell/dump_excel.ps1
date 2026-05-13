$f = 'C:\ANtigravity Apps\Hala App - Amin review\hala-commercial-engine\excell\Pipeline_Rolling_Profitability_Report_40.xlsx'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($f)

# 1. PIPELINE REPORT - find Linde rows
Write-Host "====== PIPELINE REPORT - ALL ROWS ======"
$ws = $wb.Sheets['Pipeline Report']
$range = $ws.UsedRange
$headers = @()
for ($c = 1; $c -le $range.Columns.Count; $c++) {
    $headers += $range.Cells.Item(1,$c).Text
}
Write-Host "HEADERS: $($headers -join ' | ')"
for ($r = 2; $r -le $range.Rows.Count; $r++) {
    $rowData = @()
    for ($c = 1; $c -le $range.Columns.Count; $c++) {
        $val = $range.Cells.Item($r,$c).Text
        if ($val -and $val -ne '') { $rowData += "[$c]:$val" }
    }
    if ($rowData.Count -gt 0) { Write-Host "Row${r}: $($rowData -join ' | ')" }
}

$wb.Close($false)
$excel.Quit()