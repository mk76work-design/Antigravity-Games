<#
.SYNOPSIS
    ゲームレジストリ（GAME_REGISTRY.md）を自動生成・更新する。

.DESCRIPTION
    プロジェクトルート配下のサブディレクトリを走査し、
    index.html を含むディレクトリをゲームとして検出。
    HTMLの <title> タグからゲームタイトルを抽出し、
    GAME_REGISTRY.md に一覧出力する。

.PARAMETER ProjectRoot
    分析対象のプロジェクトルートディレクトリ（必須）
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectRoot
)

# 除外するディレクトリ
$ExcludeDirs = @('.git', 'node_modules', '.agent', '.vscode', '.gemini', '__pycache__')

# 出力先
$OutputFile = Join-Path $ProjectRoot "GAME_REGISTRY.md"

function Find-Games {
    param([string]$RootPath)

    $games = @()
    $dirs = Get-ChildItem -Path $RootPath -Directory -ErrorAction SilentlyContinue | Where-Object {
        $ExcludeDirs -notcontains $_.Name
    }

    foreach ($dir in $dirs) {
        $indexFile = Join-Path $dir.FullName "index.html"
        if (Test-Path $indexFile) {
            # HTMLからタイトルを抽出
            $htmlContent = Get-Content $indexFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            $title = ""
            if ($htmlContent -match '<title[^>]*>(.*?)</title>') {
                $title = $Matches[1].Trim()
            }

            # JSファイル数を数える
            $jsFiles = Get-ChildItem -Path $dir.FullName -Filter "*.js" -Recurse -ErrorAction SilentlyContinue
            $cssFiles = Get-ChildItem -Path $dir.FullName -Filter "*.css" -Recurse -ErrorAction SilentlyContinue
            $htmlFiles = Get-ChildItem -Path $dir.FullName -Filter "*.html" -Recurse -ErrorAction SilentlyContinue

            # 合計ファイルサイズ
            $totalSize = (Get-ChildItem -Path $dir.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
            $totalSizeKB = [math]::Round($totalSize / 1KB, 1)

            $games += [PSCustomObject]@{
                Name         = $dir.Name
                Title        = if ($title) { $title } else { $dir.Name }
                Path         = $dir.Name
                JSCount      = if ($jsFiles) { $jsFiles.Count } else { 0 }
                CSSCount     = if ($cssFiles) { $cssFiles.Count } else { 0 }
                HTMLCount    = if ($htmlFiles) { $htmlFiles.Count } else { 0 }
                TotalSizeKB  = $totalSizeKB
            }
        }

        # 再帰的にサブディレクトリも探索（1階層目のみ追加探索）
        $subDirs = Get-ChildItem -Path $dir.FullName -Directory -ErrorAction SilentlyContinue | Where-Object {
            $ExcludeDirs -notcontains $_.Name
        }
        foreach ($subDir in $subDirs) {
            $subIndexFile = Join-Path $subDir.FullName "index.html"
            if (Test-Path $subIndexFile) {
                $htmlContent = Get-Content $subIndexFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
                $title = ""
                if ($htmlContent -match '<title[^>]*>(.*?)</title>') {
                    $title = $Matches[1].Trim()
                }

                $jsFiles = Get-ChildItem -Path $subDir.FullName -Filter "*.js" -Recurse -ErrorAction SilentlyContinue
                $cssFiles = Get-ChildItem -Path $subDir.FullName -Filter "*.css" -Recurse -ErrorAction SilentlyContinue
                $htmlFiles = Get-ChildItem -Path $subDir.FullName -Filter "*.html" -Recurse -ErrorAction SilentlyContinue

                $totalSize = (Get-ChildItem -Path $subDir.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
                $totalSizeKB = [math]::Round($totalSize / 1KB, 1)

                $relativePath = "$($dir.Name)/$($subDir.Name)"
                $games += [PSCustomObject]@{
                    Name         = $subDir.Name
                    Title        = if ($title) { $title } else { $subDir.Name }
                    Path         = $relativePath
                    JSCount      = if ($jsFiles) { $jsFiles.Count } else { 0 }
                    CSSCount     = if ($cssFiles) { $cssFiles.Count } else { 0 }
                    HTMLCount    = if ($htmlFiles) { $htmlFiles.Count } else { 0 }
                    TotalSizeKB  = $totalSizeKB
                }
            }
        }
    }

    return $games
}

# メイン処理
Write-Host "🎮 ゲームレジストリを更新中: $ProjectRoot"

$games = Find-Games -RootPath $ProjectRoot

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$content = @()
$content += "# 🎮 GAME_REGISTRY.md"
$content += ""
$content += "> 自動生成ドキュメント — 最終更新: $timestamp"
$content += "> "
$content += "> このファイルは ```.agent/skills/project_analyzer/scripts/update_game_registry.ps1``` によって自動生成されます。"
$content += ""
$content += "---"
$content += ""
$content += "## 登録済みゲーム一覧"
$content += ""

if ($games.Count -eq 0) {
    $content += "> まだゲームが登録されていません。ゲームディレクトリに `index.html` を配置すると自動検出されます。"
} else {
    $content += "| # | タイトル | ディレクトリ | HTML | JS | CSS | サイズ (KB) |"
    $content += "|---|---------|------------|------|----|----|-----------|"
    $i = 1
    foreach ($game in ($games | Sort-Object Path)) {
        $content += "| $i | **$($game.Title)** | ``$($game.Path)`` | $($game.HTMLCount) | $($game.JSCount) | $($game.CSSCount) | $($game.TotalSizeKB) |"
        $i++
    }
}

$content += ""
$content += "---"
$content += ""
$content += "## ゲーム詳細メモ"
$content += ""
$content += "> エージェントはここに、各ゲームの概要・技術的特徴・既知の問題などを手動で追記してください。"
$content += ""

$content -join "`n" | Out-File -FilePath $OutputFile -Encoding UTF8

Write-Host "✅ GAME_REGISTRY.md を生成しました: $OutputFile"
Write-Host "   検出されたゲーム数: $($games.Count)"
