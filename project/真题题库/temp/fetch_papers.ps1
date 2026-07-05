# Get content from newdu.com
function Get-NewduContent {
    param($Url, $MaxRetries=3)
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -TimeoutSec 20 -UseBasicParsing
            return $r.Content
        } catch {
            if ($i -lt $MaxRetries) { Start-Sleep 2 } else { return $null }
        }
    }
}

function Extract-EnglishText($html) {
    # Find content between the paper sections
    $text = $html -replace '(?s).*TRS_UEDITOR.*?-->', '' -replace '(?s)<!--电脑版内容结束.*', ''
    # Remove scripts and styles
    $text = $text -replace '<script[^>]*>.*?</script>', ''
    $text = $text -replace '<style[^>]*>.*?</style>', ''
    # Remove HTML tags with newlines
    $text = $text -replace '<br\s*/?>', "`n"
    $text = $text -replace '<P>', "`n<P>"
    $text = $text -replace '</P>', ''
    $text = $text -replace '<[^>]+>', ' '
    # Decode entities
    $text = $text -replace '&nbsp;', ' '
    $text = $text -replace '&amp;', '&'
    $text = $text -replace '&#39;', "'"
    $text = $text -replace '&quot;', '"'
    $text = $text -replace '&lt;', '<'
    $text = $text -replace '&gt;', '>'
    $text = $text -replace '&ldquo;', '"'
    $text = $text -replace '&rdquo;', '"'
    $text = $text -replace '\s+', ' '
    return $text
}

function Save-EnglishPaper {
    param($BaseUrl, $Year, $Type, $Part, $OutPath)

    Write-Host "Fetching $Year $Type Part $Part..."
    $url = "$BaseUrl.html"
    $html = Get-NewduContent $url
    if (-not $html) {
        Write-Host "FAILED to fetch main page"
        return $false
    }

    $text = Extract-EnglishText $html
    $sb = New-Object System.Text.StringBuilder
    $null = $sb.AppendLine("# $Year 年考研英语$Type真题")
    $null = $sb.AppendLine()

    # Parse sub-pages
    $subPages = @()
    if ($Part -eq "1") {
        $subPages = @("", "_2", "_3", "_4", "_5", "_7", "_11", "_12", "_13", "_14", "_15", "_16", "_17")
    } else {
        $subPages = @("", "_2", "_3", "_4", "_5", "_7", "_11", "_12", "_13", "_14")
    }

    foreach ($suffix in $subPages) {
        $pageUrl = "$BaseUrl$suffix.html"
        if ($suffix -eq "") { $pageUrl = "$BaseUrl.html" }

        Write-Host "  Page: $suffix"
        $pageHtml = Get-NewduContent $pageUrl
        if (-not $pageHtml) { continue }

        $pageText = Extract-EnglishText $pageText
        $pageText = Extract-EnglishText $pageHtml

        # Determine section name
        $sectionName = "全文"
        if ($suffix -eq "_2") { $sectionName = "Text 1" }
        elseif ($suffix -eq "_3") { $sectionName = "Text 2" }
        elseif ($suffix -eq "_4") { $sectionName = "Text 3" }
        elseif ($suffix -eq "_5") { $sectionName = "Text 4" }
        elseif ($suffix -eq "_7") { $sectionName = "翻译" }
        elseif ($suffix -match "_1[1-7]") { $sectionName = "答案解析" }

        $null = $sb.AppendLine("## $sectionName")
        $null = $sb.AppendLine()

        # Extract only English content
        $lines = $pageText -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' -and $_.Length -gt 15 }
        $filtered = $lines | Where-Object { $_ -match '[a-zA-Z]{3,}' }
        $filtered | ForEach-Object { $null = $sb.AppendLine($_) }
        $null = $sb.AppendLine()
    }

    # Also get the main page content
    $mainText = Extract-EnglishText $html
    $lines = $mainText -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' -and $_.Length -gt 20 }
    $filtered = $lines | Where-Object { $_ -match '[a-zA-Z]{3,}' }
    $filtered | ForEach-Object { $null = $sb.AppendLine($_) }

    $content = $sb.ToString()
    $content | Out-File -FilePath $OutPath -Encoding UTF8
    Write-Host "Saved: $OutPath"
    return $true
}

# Main execution
$base = "D:\zhuomian\我不是词神\真题题库\temp"

$jobs = @()

# 2017 英语一
$url = "http://edu.newdu.com/Master/English/Oldexam/201612/209446"
$result = Save-EnglishPaper -BaseUrl $url -Year 2017 -Type "（一）" -Part 1 -OutPath "$base\2017_yi1_test.html"
Write-Host "2017 英语一: $result"