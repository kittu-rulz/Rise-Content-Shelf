#!/usr/bin/env python3
"""
Aptara Content Shelf - Portable Distribution Packager
Creates a standalone portable zip package containing all assets, vendor scripts, and documentation.
"""

import os
import sys
import zipfile
from pathlib import Path

def package():
    base_dir = Path(__file__).resolve().parent.parent
    dist_dir = base_dir / 'dist'
    dist_dir.mkdir(exist_ok=True)
    
    archive_name = 'aptara-content-shelf-portable.zip'
    archive_path = dist_dir / archive_name
    
    files_to_pack = [
        ('index.html', 'index.html'),
        ('word-import.js', 'word-import.js'),
        ('uat.html', 'uat.html'),
        ('README.txt', 'README.txt'),
        ('vendor/jszip.min.js', 'vendor/jszip.min.js'),
        ('vendor/JSZIP-LICENSE.md', 'vendor/JSZIP-LICENSE.md'),
    ]
    
    # Include sample storyboard if available
    storyboard = base_dir / 'Rise_Storyboard_Populated_UAT.docx'
    if storyboard.exists():
        files_to_pack.append(('Rise_Storyboard_Populated_UAT.docx', 'Rise_Storyboard_Populated_UAT.docx'))
        
    print(f"Creating portable package: {archive_path}")
    with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for src_rel, arc_rel in files_to_pack:
            src_path = base_dir / src_rel
            if src_path.exists():
                print(f"  + Adding {src_rel} -> {arc_rel}")
                zf.write(src_path, arc_rel)
            else:
                print(f"  ! Warning: {src_rel} does not exist!")
                
    print(f"\nSuccessfully created portable package ({archive_path.stat().st_size:,} bytes).")

if __name__ == '__main__':
    package()

