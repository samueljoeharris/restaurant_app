#!/usr/bin/env python3
"""Regenerate ios/TTF/TTF.xcodeproj/project.pbxproj from the TTF/ source tree.

Run from repo root after adding/removing Swift files:
  python3 scripts/regenerate-ios-xcodeproj.py

Requires only Python 3 (no Xcode). Updates the shared scheme target ID to match.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
IOS_ROOT = REPO_ROOT / "ios" / "TTF"


def uid(seed: str) -> str:
    return hashlib.sha1(f"ttf-v2-{seed}".encode()).hexdigest()[:24].upper()


def main() -> None:
    swift_files: list[str] = []
    for dirpath, _, filenames in os.walk(IOS_ROOT / "TTF"):
        for name in sorted(filenames):
            if name.endswith(".swift"):
                rel = Path(dirpath, name).relative_to(IOS_ROOT).as_posix()
                swift_files.append(rel)

    resources = ["TTF/Resources/Assets.xcassets"]
    config_files = ["Config/Debug.xcconfig", "Config/Release.xcconfig"]

    file_refs: dict[str, tuple[str, str]] = {}
    build_files: dict[str, tuple[str, str]] = {}

    def ref(path: str, typ: str = "sourcecode.swift") -> str:
        key = uid(f"ref:{path}")
        file_refs[path] = (key, typ)
        return key

    def bfile(path: str) -> str:
        rkey, _ = file_refs[path]
        bkey = uid(f"build:{path}")
        build_files[path] = (bkey, rkey)
        return bkey

    for f in swift_files:
        ref(f)
        bfile(f)
    for r in resources:
        ref(r, "folder.assetcatalog")
        bfile(r)
    for c in config_files:
        ref(c, "text.xcconfig")

    def lst(items: list[str]) -> str:
        return ", ".join(items)

    product_ref = uid("product")
    target_ref = uid("target")
    project_ref = uid("project")
    main_group = uid("maingroup")
    products_group = uid("productsgroup")
    ttf_group = uid("ttfgroup")
    config_group = uid("configgroup")
    sources_phase = uid("sources")
    resources_phase = uid("resources")
    frameworks_phase = uid("frameworks")
    proj_config_list = uid("projconfigs")
    tgt_config_list = uid("tgtconfigs")
    proj_debug = uid("projdebug")
    proj_release = uid("projrelease")
    tgt_debug = uid("tgtdebug")
    tgt_release = uid("tgtrelease")

    groups: dict[str, dict] = {
        main_group: {"name": None, "path": None, "children": []},
        products_group: {"name": "Products", "path": None, "children": [product_ref]},
        config_group: {
            "name": "Config",
            "path": "Config",
            "children": [file_refs[c][0] for c in config_files],
        },
        ttf_group: {"name": "TTF", "path": "TTF", "children": []},
    }

    subgroups: dict[str, str] = {}
    for f in swift_files + resources:
        parts = f.split("/")[1:-1]
        parent = ttf_group
        accum = "TTF"
        for part in parts:
            accum += "/" + part
            if accum not in subgroups:
                gid = uid(f"group:{accum}")
                subgroups[accum] = gid
                groups[gid] = {"name": part, "path": part, "children": []}
                groups[parent]["children"].append(gid)
            parent = subgroups[accum]
        groups[parent]["children"].append(file_refs[f][0])

    groups[main_group]["children"] = [ttf_group, config_group, products_group]

    lines: list[str] = []
    lines.append("// !$*UTF8*$!")
    lines.append("{")
    lines.append("\tarchiveVersion = 1;")
    lines.append("\tclasses = {};")
    lines.append("\tobjectVersion = 56;")
    lines.append("\tobjects = {")

    for path, (bkey, rkey) in build_files.items():
        name = os.path.basename(path)
        lines.append(
            f"\t\t{bkey} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {rkey} /* {name} */; }};"
        )

    for path, (rkey, typ) in file_refs.items():
        name = os.path.basename(path)
        if typ == "folder.assetcatalog":
            lines.append(
                f"\t\t{rkey} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = {name}; sourceTree = \"<group>\"; }};"
            )
        elif typ == "text.xcconfig":
            lines.append(
                f"\t\t{rkey} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = text.xcconfig; path = {name}; sourceTree = \"<group>\"; }};"
            )
        else:
            lines.append(
                f"\t\t{rkey} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {name}; sourceTree = \"<group>\"; }};"
            )

    lines.append(
        f"\t\t{product_ref} /* Little Scout.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = \"Little Scout.app\"; sourceTree = BUILT_PRODUCTS_DIR; }};"
    )
    lines.append(
        f"\t\t{frameworks_phase} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};"
    )

    for gid, meta in groups.items():
        children = lst(meta["children"])
        if meta["name"] is None:
            lines.append(
                f"\t\t{gid} = {{isa = PBXGroup; children = ({children}); sourceTree = \"<group>\"; }};"
            )
        else:
            path_line = f' path = {meta["path"]};' if meta["path"] else ""
            lines.append(
                f"\t\t{gid} /* {meta['name']} */ = {{isa = PBXGroup; children = ({children});{path_line} sourceTree = \"<group>\"; }};"
            )

    lines.append(
        f"\t\t{target_ref} /* TTF */ = {{isa = PBXNativeTarget; buildConfigurationList = {tgt_config_list}; buildPhases = ({sources_phase} /* Sources */, {frameworks_phase} /* Frameworks */, {resources_phase} /* Resources */); buildRules = (); dependencies = (); name = TTF; productName = TTF; productReference = {product_ref}; productType = \"com.apple.product-type.application\"; }};"
    )
    lines.append(
        f"\t\t{project_ref} /* Project object */ = {{isa = PBXProject; attributes = {{BuildIndependentTargetsInParallel = 1; LastUpgradeCheck = 1500; TargetAttributes = {{{target_ref} = {{CreatedOnToolsVersion = 15.0;}};}};}}; buildConfigurationList = {proj_config_list}; compatibilityVersion = \"Xcode 14.0\"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = {main_group}; productRefGroup = {products_group}; projectDirPath = \"\"; projectRoot = \"\"; targets = ({target_ref}); }};"
    )

    res_files = lst([build_files[r][0] for r in resources])
    lines.append(
        f"\t\t{resources_phase} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({res_files}); runOnlyForDeploymentPostprocessing = 0; }};"
    )

    src_files = lst([build_files[f][0] for f in swift_files])
    lines.append(
        f"\t\t{sources_phase} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({src_files}); runOnlyForDeploymentPostprocessing = 0; }};"
    )

    debug_base = file_refs["Config/Debug.xcconfig"][0]
    release_base = file_refs["Config/Release.xcconfig"][0]

    lines.append(
        f"\t\t{proj_debug} /* Debug */ = {{isa = XCBuildConfiguration; baseConfigurationReference = {debug_base}; buildSettings = {{ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; COPY_PHASE_STRIP = NO; DEBUG_INFORMATION_FORMAT = dwarf; ENABLE_STRICT_OBJC_MSGSEND = YES; GCC_DYNAMIC_NO_PIC = NO; IPHONEOS_DEPLOYMENT_TARGET = 17.0; MTL_ENABLE_DEBUG_INFO = YES; ONLY_ACTIVE_ARCH = YES; SDKROOT = iphoneos; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; SWIFT_OPTIMIZATION_LEVEL = \"-Onone\"; SWIFT_VERSION = 5.10;}}; name = Debug; }};"
    )
    lines.append(
        f"\t\t{proj_release} /* Release */ = {{isa = XCBuildConfiguration; baseConfigurationReference = {release_base}; buildSettings = {{ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; COPY_PHASE_STRIP = NO; DEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\"; ENABLE_STRICT_OBJC_MSGSEND = YES; GCC_DYNAMIC_NO_PIC = NO; IPHONEOS_DEPLOYMENT_TARGET = 17.0; MTL_ENABLE_DEBUG_INFO = NO; ONLY_ACTIVE_ARCH = NO; SDKROOT = iphoneos; SWIFT_OPTIMIZATION_LEVEL = \"-O\"; SWIFT_VERSION = 5.10;}}; name = Release; }};"
    )

    for cfg_id, name, base in [
        (tgt_debug, "Debug", debug_base),
        (tgt_release, "Release", release_base),
    ]:
        lines.append(
            f"\t\t{cfg_id} /* {name} */ = {{isa = XCBuildConfiguration; baseConfigurationReference = {base}; buildSettings = {{ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = \"\"; ENABLE_USER_SCRIPT_SANDBOXING = YES; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = TTF/Resources/Info.plist; INFOPLIST_KEY_CFBundleDisplayName = \"Little Scout\"; INFOPLIST_KEY_NSLocationWhenInUseUsageDescription = \"Little Scout uses your location to show nearby restaurants in the pilot area.\"; INFOPLIST_KEY_UILaunchScreen_Generation = YES; LD_RUNPATH_SEARCH_PATHS = (\"$(inherited)\", \"@executable_path/Frameworks\"); MARKETING_VERSION = 0.1.0; PRODUCT_BUNDLE_IDENTIFIER = com.samueljoeharris.ttf; PRODUCT_NAME = \"Little Scout\"; SWIFT_EMIT_LOC_STRINGS = YES; SWIFT_VERSION = 5.10; TARGETED_DEVICE_FAMILY = 1;}}; name = {name}; }};"
        )

    lines.append(
        f"\t\t{proj_config_list} = {{isa = XCConfigurationList; buildConfigurations = ({proj_debug}, {proj_release}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};"
    )
    lines.append(
        f"\t\t{tgt_config_list} = {{isa = XCConfigurationList; buildConfigurations = ({tgt_debug}, {tgt_release}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};"
    )

    lines.append("\t};")
    lines.append(f"\trootObject = {project_ref} /* Project object */;")
    lines.append("}")

    pbxproj = IOS_ROOT / "TTF.xcodeproj" / "project.pbxproj"
    pbxproj.write_text("\n".join(lines) + "\n")

    scheme_path = IOS_ROOT / "TTF.xcodeproj" / "xcshareddata" / "xcschemes" / "TTF.xcscheme"
    scheme = scheme_path.read_text()
    import re

    scheme = re.sub(
        r'BlueprintIdentifier = "[0-9A-F]+"',
        f'BlueprintIdentifier = "{target_ref}"',
        scheme,
    )
    scheme_path.write_text(scheme)

    print(f"Wrote {pbxproj} ({len(swift_files)} Swift files)")
    print(f"Scheme target ID: {target_ref}")


if __name__ == "__main__":
    main()
