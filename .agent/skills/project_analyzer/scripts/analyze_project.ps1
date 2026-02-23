<#
.SYNOPSIS
    プロジェクト構造を分析し、PROJECT_STRUCTURE.md を生成する。

.DESCRIPTION
    プロジェクトルートをスキャンし、ディレクトリツリー、ファイル一覧、
    各ファイルの行数・サイズを集計して PROJECT_STRUCTURE.md に出力する。

.PARAMETER ProjectRoot
    分析対象のプロジェクトルートディレクトリ（必須）
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectRoot
)

# 除外するディレクトリ・ファイルパターン
$ExcludeDirs = @('.git', 'node_modules', '.agent', '.vscode', '.gemini', '__pycache__', '.next', 'dist', 'build', 'docs')
$ExcludeFiles = @('*.lock', '*.log', 'package-lock.json')

# 出力先（docs/ サブディレクトリ内）
$DocsDir = Join-Path $ProjectRoot "docs"
if (-not (Test-Path $DocsDir)) {
    New-Item -ItemType Directory -Path $DocsDir -Force | Out-Null
}
$OutputFile = Join-Path $DocsDir "PROJECT_STRUCTURE.md"

function Get-DirectoryTree {
    param(
        [string]$Path,
        [string]$Prefix = "",
        [int]$Depth = 0,
        [int]$MaxDepth = 4
    )

    if ($Depth -ge $MaxDepth) { return @() }

    $items = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue | Sort-Object { -not $_.PSIsContainer }, Name
    $result = @()

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $items.Count - 1)
        $connector = if ($isLast) { "└── " } else { "├── " }
        $extension = if ($isLast) { "    " } else { "│   " }

        # 除外チェック
        if ($item.PSIsContainer) {
            if ($ExcludeDirs -contains $item.Name) { continue }
            $result += "$Prefix$connector📁 $($item.Name)/"
            $result += Get-DirectoryTree -Path $item.FullName -Prefix "$Prefix$extension" -Depth ($Depth + 1) -MaxDepth $MaxDepth
        } else {
            $skip = $false
            foreach ($pattern in $ExcludeFiles) {
                if ($item.Name -like $pattern) { $skip = $true; break }
            }
            if ($skip) { continue }
            $result += "$Prefix$connector$($item.Name)"
        }
    }

    return $result
}

function Get-FileStats {
    param([string]$Path)

    $files = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $dir = $_.DirectoryName
        $exclude = $false
        foreach ($d in $ExcludeDirs) {
            if ($dir -match [regex]::Escape($d)) { $exclude = $true; break }
        }
        -not $exclude
    }

    $stats = @()
    foreach ($file in $files) {
        $skip = $false
        foreach ($pattern in $ExcludeFiles) {
            if ($file.Name -like $pattern) { $skip = $true; break }
        }
        if ($skip) { continue }

        $lineCount = 0
        $extension = $file.Extension.ToLower()
        $textExtensions = @('.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.md', '.json', '.txt', '.py', '.ps1', '.sh', '.yaml', '.yml', '.xml', '.svg')

        if ($textExtensions -contains $extension) {
            try {
                $lineCount = (Get-Content $file.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
            } catch {
                $lineCount = 0
            }
        }

        $relativePath = $file.FullName.Replace($Path, '').TrimStart('\', '/')
        $sizeKB = [math]::Round($file.Length / 1KB, 1)

        $stats += [PSCustomObject]@{
            Path      = $relativePath
            Extension = $extension
            SizeKB    = $sizeKB
            Lines     = $lineCount
        }
    }

    return $stats
}

# メイン処理
Write-Host "📊 プロジェクト構造を分析中: $ProjectRoot"

$tree = Get-DirectoryTree -Path $ProjectRoot
$fileStats = Get-FileStats -Path $ProjectRoot

# 拡張子別集計
$extSummary = $fileStats | Group-Object Extension | Sort-Object Count -Descending | ForEach-Object {
    [PSCustomObject]@{
        Extension  = if ($_.Name) { $_.Name } else { "(なし)" }
        FileCount  = $_.Count
        TotalLines = ($_.Group | Measure-Object Lines -Sum).Sum
        TotalSizeKB = [math]::Round(($_.Group | Measure-Object SizeKB -Sum).Sum, 1)
    }
}

# Markdown生成
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$content = @()
$content += "# 📂 PROJECT_STRUCTURE.md"
$content += ""
$content += "> 自動生成ドキュメント — 最終更新: $timestamp"
$content += "> "
$content += "> このファイルは ```.agent/skills/project_analyzer/scripts/analyze_project.ps1``` によって自動生成されます。"
$content += ""
$content += "---"
$content += ""
$content += "## ディレクトリツリー"
$content += ""
$content += '```'
$content += $tree
$content += '```'
$content += ""
$content += "---"
$content += ""
$content += "## ファイル種別サマリー"
$content += ""
$content += "| 拡張子 | ファイル数 | 合計行数 | 合計サイズ (KB) |"
$content += "|--------|----------|---------|---------------|"
foreach ($ext in $extSummary) {
    $content += "| $($ext.Extension) | $($ext.FileCount) | $($ext.TotalLines) | $($ext.TotalSizeKB) |"
}
$content += ""
$content += "---"
$content += ""
$content += "## 全ファイル一覧"
$content += ""
$content += "| パス | 拡張子 | 行数 | サイズ (KB) |"
$content += "|------|--------|------|-----------|"
foreach ($file in ($fileStats | Sort-Object Path)) {
    $content += "| ``$($file.Path)`` | $($file.Extension) | $($file.Lines) | $($file.SizeKB) |"
}
$content += ""
$content += "---"
$content += ""
$content += "## アーキテクチャメモ"
$content += ""
$content += "> エージェントはここに、ファイル間の依存関係や設計判断のメモを手動で追記してください。"
$content += ""

$content -join "`n" | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "✅ PROJECT_STRUCTURE.md を生成しました: $OutputFile"
