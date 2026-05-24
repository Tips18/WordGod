# Download Kaoyan English articles from public WordCram test pages.
param(
    [int]$StartYear = 2026,
    [int]$EndYear = 1998,
    [string]$OutputRoot = "wordcram-kaoyan"
)

$ErrorActionPreference = "Stop"
$BaseUrl = "https://wordcram.com.cn"

# Gets public HTML and returns null when the request fails.
function Get-PublicHtml {
    param([string]$Url)

    try {
        $headers = @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            "Accept" = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        $response = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing -TimeoutSec 30
        return $response.Content
    }
    catch {
        return $null
    }
}

# Converts a small HTML fragment to plain Markdown-friendly text.
function Convert-HtmlFragmentToText {
    param([string]$Html)

    if ([string]::IsNullOrWhiteSpace($Html)) {
        return ""
    }

    $text = $Html
    $text = $text -replace '(?is)<script\b[^>]*>.*?</script>', ''
    $text = $text -replace '(?is)<style\b[^>]*>.*?</style>', ''
    $text = $text -replace '(?is)<span\b[^>]*class=["'']fill-in["''][^>]*>\s*<span>(.*?)</span>\s*</span>', '____($1)____'
    $text = $text -replace '(?i)<br\s*/?>', "`n"
    $text = $text -replace '(?is)</p\s*>', "`n`n"
    $text = $text -replace '(?is)<[^>]+>', ' '
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    $text = $text -replace "[`r`t]", " "
    $text = $text -replace ' +', ' '
    $text = $text -replace " *`n *", "`n"
    $text = $text -replace "(`n){3,}", "`n`n"
    return $text.Trim()
}

# Locates the exam content container and avoids navigation and footer content.
function Get-ContentStreamHtml {
    param([string]$Html)

    $match = [regex]::Match(
        $Html,
        '<div[^>]+id=["'']content-stream["''][^>]*>(?<body>.*?)</div>\s*</div>\s*</div>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($match.Success) {
        return $match.Groups["body"].Value
    }

    return ""
}

# Extracts article paragraphs after a heading until questions or the next section begin.
function Get-ArticleByHeading {
    param(
        [string]$BodyHtml,
        [string]$Heading
    )

    $headingPattern = '<h[1-6][^>]*>\s*' + [regex]::Escape($Heading) + '\s*</h[1-6]>'
    $headingMatch = [regex]::Match($BodyHtml, $headingPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $headingMatch.Success) {
        return $null
    }

    $tail = $BodyHtml.Substring($headingMatch.Index + $headingMatch.Length)
    $nextMatch = [regex]::Match(
        $tail,
        '(?is)<p[^>]*class=["'']no-indent["''][^>]*>\s*(?:\d{1,2}\.|[A-D]\])|<h[1-6][^>]*>\s*(?:Text\s+[1-4]|Part\s+B|Part\s+C|Section\s+III|Reference Answers)',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($nextMatch.Success) {
        $tail = $tail.Substring(0, $nextMatch.Index)
    }

    $text = Convert-HtmlFragmentToText -Html $tail
    if ($text.Length -lt 120) {
        return $null
    }

    return @{
        title = $Heading
        content = $text
        wordCount = ([regex]::Matches($text, '\b[A-Za-z][A-Za-z''-]*\b')).Count
    }
}

# Extracts cloze and Reading Part A Text 1-4 while excluding answers and options.
function Get-KaoyanArticles {
    param([string]$BodyHtml)

    $articles = New-Object System.Collections.Generic.List[object]

    $sectionMatch = [regex]::Match($BodyHtml, '(?is)<h4>\s*Section I Use of English\s*</h4>(?<tail>.*?)(?:<table>|<h4>\s*Section II)')
    if ($sectionMatch.Success) {
        $sectionText = Convert-HtmlFragmentToText -Html $sectionMatch.Groups["tail"].Value
        $sectionText = ($sectionText -split "`n`n" | Where-Object { $_ -notmatch '^Directions:' -and $_ -notmatch '^Read the following text' }) -join "`n`n"
        if ($sectionText.Length -ge 120) {
            $articles.Add(@{
                title = "Section I Use of English"
                content = $sectionText.Trim()
                wordCount = ([regex]::Matches($sectionText, '\b[A-Za-z][A-Za-z''-]*\b')).Count
            })
        }
    }

    foreach ($heading in @("Text 1", "Text 2", "Text 3", "Text 4")) {
        $article = Get-ArticleByHeading -BodyHtml $BodyHtml -Heading $heading
        if ($null -ne $article) {
            $articles.Add($article)
        }
    }

    return $articles
}

# Saves one year's articles to Markdown and returns index metadata.
function Save-YearMarkdown {
    param(
        [int]$Year,
        [string]$SourceUrl,
        [object[]]$Articles,
        [string]$ArticlesDir
    )

    $fileName = "$Year-kaoyan-english-i-articles.md"
    $filePath = Join-Path $ArticlesDir $fileName
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# $Year Kaoyan English I Articles")
    $lines.Add("")
    $lines.Add("> Source: $SourceUrl")
    $lines.Add("> Scope: public WordCram online test page only; PDFs, answer analysis, login-only content, and download-limit flows are excluded.")
    $lines.Add("")

    foreach ($article in $Articles) {
        $lines.Add("## $($article.title)")
        $lines.Add("")
        $lines.Add($article.content)
        $lines.Add("")
    }

    Set-Content -LiteralPath $filePath -Value $lines -Encoding UTF8

    return @{
        year = $Year
        paper = "english-i"
        sourceUrl = $SourceUrl
        file = "articles/$fileName"
        articleCount = $Articles.Count
        wordCount = ($Articles | ForEach-Object { $_.wordCount } | Measure-Object -Sum).Sum
        titles = @($Articles | ForEach-Object { $_.title })
    }
}

# Requests each public year page, writes Markdown files, and emits index.json.
function Invoke-Download {
    $paperRoot = Split-Path -Parent $PSScriptRoot
    $outputRootPath = Join-Path $paperRoot $OutputRoot
    $articlesDir = Join-Path $outputRootPath "articles"
    New-Item -ItemType Directory -Force -Path $articlesDir | Out-Null

    $index = New-Object System.Collections.Generic.List[object]
    $failures = New-Object System.Collections.Generic.List[object]

    for ($year = $StartYear; $year -ge $EndYear; $year--) {
        $sourceUrl = "$BaseUrl/tests/kaoyan/$year"
        Write-Host "Fetching $sourceUrl"
        $html = Get-PublicHtml -Url $sourceUrl
        if ([string]::IsNullOrWhiteSpace($html)) {
            $failures.Add(@{ year = $year; sourceUrl = $sourceUrl; reason = "request_failed" })
            continue
        }

        $body = Get-ContentStreamHtml -Html $html
        $articles = @(Get-KaoyanArticles -BodyHtml $body)
        if ($articles.Count -eq 0) {
            $failures.Add(@{ year = $year; sourceUrl = $sourceUrl; reason = "no_articles_found" })
            continue
        }

        $index.Add((Save-YearMarkdown -Year $year -SourceUrl $sourceUrl -Articles $articles -ArticlesDir $articlesDir))
        Start-Sleep -Milliseconds 500
    }

    $metadata = @{
        source = "WordCram"
        sourcePage = "$BaseUrl/zhenti-kaoyan"
        generatedAt = (Get-Date).ToString("o")
        scope = "public /tests/kaoyan/{year} pages only; PDF downloads and restricted flows intentionally excluded"
        items = @($index.ToArray())
        failures = @($failures.ToArray())
    }

    $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRootPath "index.json") -Encoding UTF8
    Write-Host "Saved $($index.Count) Markdown files and index.json to $outputRootPath"
}

Invoke-Download
