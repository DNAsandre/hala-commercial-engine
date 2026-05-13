$f = 'C:\ANtigravity Apps\Hala App - Amin review\hala-commercial-engine\excell\Pipeline_Rolling_Profitability_Report_40.xlsx'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($f)

function Get-SheetData($ws) {
    $range = $ws.UsedRange
    $result = @()
    for ($r = 1; $r -le $range.Rows.Count; $r++) {
        $row = @()
        for ($c = 1; $c -le $range.Columns.Count; $c++) {
            $row += $range.Cells.Item($r,$c).Text
        }
        $result += ,($row)
    }
    return $result
}

# PIPELINE REPORT
Write-Host "===== PIPELINE REPORT ====="
$ws = $wb.Sheets['Pipeline Report']
$data = Get-SheetData $ws
Write-Host "Headers: $($data[0] -join ' | ')"
for ($i = 1; $i -lt [Math]::Min($data.Count, 220); $i++) {
    $nonEmpty = @()
    for ($c = 0; $c -lt $data[$i].Count; $c++) {
        if ($data[$i][$c] -and $data[$i][$c] -ne '') { $nonEmpty += "$c=$($data[$i][$c])" }
    }
    if ($nonEmpty.Count -gt 0) { Write-Host "R$i`: $($nonEmpty -join ' | ')" }
}

$wb.Close($false)
$excel.Quit()