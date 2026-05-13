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

$sheets = @('Executive Dashboard','Pipeline Report','Pipeline Data Input','Warehouse Pallet data input','Revenue Data Input','Closed-won data Input','WH Revenue Data Input','Forecast +75% - 100%')

foreach ($sname in $sheets) {
    Write-Host "`n`n==========================================`nSHEET: $sname`n=========================================="
    $ws = $wb.Sheets[$sname]
    if ($ws -eq $null) { Write-Host "NOT FOUND"; continue }
    $data = Get-SheetData $ws
    Write-Host "Rows: $($data.Count) | Cols: $($data[0].Count)"
    Write-Host "HEADERS: $($data[0] -join ' | ')"
    # Print first 15 data rows
    for ($i = 1; $i -lt [Math]::Min($data.Count, 16); $i++) {
        $nonEmpty = @()
        for ($c = 0; $c -lt $data[$i].Count; $c++) {
            if ($data[$i][$c] -and $data[$i][$c] -ne '') { $nonEmpty += "[$c]=$($data[$i][$c])" }
        }
        if ($nonEmpty.Count -gt 0) { Write-Host "R$i`: $($nonEmpty -join ' | ')" }
    }
}

$wb.Close($false)
$excel.Quit()