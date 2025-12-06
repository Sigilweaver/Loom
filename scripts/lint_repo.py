#!/usr/bin/env python3
"""
Repository linter for Sigilweaver.

Checks git-tracked files for:
- Empty files
- Non-standard characters (outside ASCII keyboard range)

Respects .gitignore by using git ls-files.

Usage:
    ./scripts/lint_repo.py              # Run all checks
    ./scripts/lint_repo.py --empty      # Check empty files only
    ./scripts/lint_repo.py --chars      # Check non-standard chars only
    ./scripts/lint_repo.py path/to/repo # Specify repo path
"""

import argparse
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path


# File extensions to check for non-standard characters
TEXT_EXTENSIONS = {
    ".md", ".txt", ".rst",
    ".py", ".pyi",
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".jsonc",
    ".yml", ".yaml",
    ".sh", ".bash", ".zsh",
    ".css", ".scss", ".less",
    ".html", ".htm",
    ".xml",
    ".toml", ".ini", ".cfg",
    ".env", ".env.example",
    ".gitignore", ".gitattributes",
    ".eslintrc", ".prettierrc",
}

# Files to skip entirely (binary, lock files, etc.)
SKIP_PATTERNS = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Cargo.lock",
}


@dataclass
class CharFinding:
    """A non-standard character finding."""
    line_num: int
    col: int
    char: str
    code_point: int
    name: str
    context: str


@dataclass
class FileFinding:
    """Findings for a single file."""
    path: Path
    rel_path: str
    is_empty: bool = False
    char_findings: list[CharFinding] = field(default_factory=list)


def get_repo_root(start_path: Path) -> Path | None:
    """Find the git repository root."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=start_path,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return Path(result.stdout.strip())
    return None


def get_tracked_files(repo_path: Path) -> list[str]:
    """Get list of files tracked by git (respects .gitignore)."""
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=True,
    )
    return [f for f in result.stdout.strip().split("\n") if f]


def should_check_chars(file_path: Path) -> bool:
    """Determine if file should be checked for non-standard characters."""
    name = file_path.name
    
    # Skip known binary/lock files
    if name in SKIP_PATTERNS:
        return False
    
    # Check by extension
    suffix = file_path.suffix.lower()
    if suffix in TEXT_EXTENSIONS:
        return True
    
    # Check extensionless files that are likely text
    if not suffix and name in {
        "Makefile", "Dockerfile", "Jenkinsfile",
        "LICENSE", "README", "CHANGELOG",
        ".gitignore", ".gitattributes", ".editorconfig",
    }:
        return True
    
    return False


def is_standard_char(code_point: int) -> bool:
    """Check if character is in standard ASCII keyboard range."""
    # Tab, newline, carriage return
    if code_point in (9, 10, 13):
        return True
    # Printable ASCII: space (32) through tilde (126)
    if 32 <= code_point <= 126:
        return True
    return False


def check_file_chars(file_path: Path, rel_path: str) -> list[CharFinding]:
    """Check a file for non-standard characters."""
    findings = []
    
    try:
        content = file_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        # Skip files that can't be read as UTF-8
        return findings
    
    for line_num, line in enumerate(content.split("\n"), start=1):
        for col, char in enumerate(line, start=1):
            code_point = ord(char)
            if not is_standard_char(code_point):
                try:
                    name = unicodedata.name(char, "UNKNOWN")
                except ValueError:
                    name = "UNKNOWN"
                
                # Get context (truncate long lines)
                context = line
                if len(context) > 100:
                    # Show around the character
                    start = max(0, col - 40)
                    end = min(len(line), col + 40)
                    context = ("..." if start > 0 else "") + line[start:end] + ("..." if end < len(line) else "")
                
                findings.append(CharFinding(
                    line_num=line_num,
                    col=col,
                    char=char,
                    code_point=code_point,
                    name=name,
                    context=context,
                ))
    
    return findings


def run_lint(
    repo_path: Path,
    check_empty: bool = True,
    check_chars: bool = True,
) -> list[FileFinding]:
    """Run linting checks on the repository."""
    findings: list[FileFinding] = []
    tracked_files = get_tracked_files(repo_path)
    
    for rel_file in tracked_files:
        file_path = repo_path / rel_file
        
        if not file_path.is_file():
            continue
        
        finding = FileFinding(path=file_path, rel_path=rel_file)
        
        # Check for empty file
        if check_empty:
            try:
                if file_path.stat().st_size == 0:
                    finding.is_empty = True
            except OSError:
                pass
        
        # Check for non-standard characters
        if check_chars and should_check_chars(file_path):
            finding.char_findings = check_file_chars(file_path, rel_file)
        
        # Only add if there are findings
        if finding.is_empty or finding.char_findings:
            findings.append(finding)
    
    return findings


def print_report(findings: list[FileFinding], repo_path: Path) -> None:
    """Print the linting report."""
    print("=" * 60)
    print("  Sigilweaver Repository Linter")
    print("=" * 60)
    print(f"Scanning: {repo_path}")
    print()
    
    empty_files = [f for f in findings if f.is_empty]
    char_files = [f for f in findings if f.char_findings]
    
    # Report empty files
    if empty_files:
        print("-" * 60)
        print("EMPTY FILES")
        print("-" * 60)
        for f in sorted(empty_files, key=lambda x: x.rel_path):
            print(f"  {f.rel_path}")
        print()
    
    # Report non-standard characters
    if char_files:
        print("-" * 60)
        print("NON-STANDARD CHARACTERS")
        print("-" * 60)
        
        total_chars = 0
        for f in sorted(char_files, key=lambda x: x.rel_path):
            print(f"\nFILE: {f.rel_path}")
            
            # Group by line
            by_line: dict[int, list[CharFinding]] = {}
            for cf in f.char_findings:
                by_line.setdefault(cf.line_num, []).append(cf)
            
            for line_num in sorted(by_line.keys()):
                chars = by_line[line_num]
                total_chars += len(chars)
                
                # Show line context once
                print(f"  Line {line_num}: {chars[0].context}")
                
                # Show each character found (limit to 5 per line)
                for cf in chars[:5]:
                    print(f"    -> {cf.char!r} at col {cf.col}: U+{cf.code_point:04X} {cf.name}")
                
                if len(chars) > 5:
                    print(f"    ... and {len(chars) - 5} more")
        print()
    
    # Summary
    print("=" * 60)
    print("  Summary")
    print("=" * 60)
    
    if empty_files:
        print(f"Empty files: {len(empty_files)}")
    else:
        print("Empty files: 0 (OK)")
    
    if char_files:
        total_chars = sum(len(f.char_findings) for f in char_files)
        print(f"Non-standard characters: {total_chars} in {len(char_files)} file(s)")
    else:
        print("Non-standard characters: 0 (OK)")
    
    if empty_files or char_files:
        print()
        print("Common replacements:")
        print("  - Arrows: -> instead of special arrow chars")
        print("  - Bullets: * or - instead of special bullets")
        print("  - Checkmarks: OK or PASS instead of checkmark symbols")
        print("  - Box drawing: =, -, | instead of box-drawing chars")
        print("  - Smart quotes: \" or ' instead of curly quotes")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lint git-tracked files for common issues"
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=".",
        help="Path to repository (default: current directory)",
    )
    parser.add_argument(
        "--empty",
        action="store_true",
        help="Check for empty files only",
    )
    parser.add_argument(
        "--chars",
        action="store_true",
        help="Check for non-standard characters only",
    )
    
    args = parser.parse_args()
    
    # Determine what to check
    check_empty = True
    check_chars = True
    if args.empty or args.chars:
        check_empty = args.empty
        check_chars = args.chars
    
    # Find repo root
    start_path = Path(args.path).resolve()
    repo_path = get_repo_root(start_path)
    
    if not repo_path:
        print(f"Error: {start_path} is not in a git repository")
        return 1
    
    # Run checks
    findings = run_lint(repo_path, check_empty=check_empty, check_chars=check_chars)
    
    # Print report
    print_report(findings, repo_path)
    
    # Exit code: 0 if clean, 1 if issues found
    has_issues = any(f.is_empty or f.char_findings for f in findings)
    return 1 if has_issues else 0


if __name__ == "__main__":
    sys.exit(main())
