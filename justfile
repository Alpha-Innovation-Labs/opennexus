# Default: Show help menu
set positional-arguments := true
export RUSTC_WRAPPER := "sccache"
default:
    @just help

# ============================================================================
# Help Command
# ============================================================================

help:
    @echo ""
    @echo "\033[1;36m======================================\033[0m"
    @echo "\033[1;36m       Nexus Project Commands           \033[0m"
    @echo "\033[1;36m======================================\033[0m"
    @echo ""
    @echo "\033[1;35m  Most Common Commands:\033[0m"
    @echo "  just \033[0;33mdev\033[0m                      \033[0;32mRun opennexus setup flow\033[0m"
    @echo "  just \033[0;33mdocs\033[0m                     \033[0;32mRun local docs server\033[0m"
    @echo "  just \033[0;33mdocs-sync\033[0m                \033[0;32mGenerate reference docs\033[0m"
    @echo "  just \033[0;33mbuild\033[0m                    \033[0;32mBuild development binary\033[0m"
    @echo "  just \033[0;33mtest\033[0m                     \033[0;32mRun all tests\033[0m"
    @echo ""
    @echo "\033[1;35m  Development:\033[0m"
    @echo "  just \033[0;33mdev\033[0m                      \033[0;32mRun opennexus setup flow\033[0m"
    @echo "  just \033[0;33mdocs\033[0m                     \033[0;32mRun local docs server\033[0m"
    @echo "  just \033[0;33mdocs-sync\033[0m                \033[0;32mGenerate reference docs\033[0m"
    @echo ""
    @echo "\033[1;35m  Building:\033[0m"
    @echo "  just \033[0;33mbuild\033[0m                    \033[0;32mBuild development binary\033[0m"
    @echo "  just \033[0;33mbuild-release\033[0m            \033[0;32mBuild release binary with codesign\033[0m"
    @echo ""
    @echo "\033[1;35m  Verification:\033[0m"
    @echo "  just \033[0;33mcheck\033[0m                    \033[0;32mCheck code compiles\033[0m"
    @echo "  just \033[0;33mclippy\033[0m                   \033[0;32mRun clippy lints\033[0m"
    @echo "  just \033[0;33mfmt\033[0m                      \033[0;32mFormat code\033[0m"
    @echo "  just \033[0;33mfmt-check\033[0m                \033[0;32mCheck formatting\033[0m"
    @echo "  just \033[0;33mdocs-sync-check\033[0m          \033[0;32mCheck docs sync drift\033[0m"
    @echo ""
    @echo "\033[1;35m  Utilities:\033[0m"
    @echo "  just \033[0;33mclean\033[0m                    \033[0;32mClean build artifacts\033[0m"
    @echo "  just \033[0;33minstall\033[0m                  \033[0;32mInstall opennexus globally\033[0m"
    @echo "  just \033[0;33muninstall\033[0m                \033[0;32mUninstall opennexus globally\033[0m"
    @echo "  just \033[0;33mdocs-gh-pub\033[0m              \033[0;32mPublish docs to gh-pages\033[0m"
    @echo "  just \033[0;33mpub\033[0m                      \033[0;32mBump, tag, and publish crate\033[0m"
    @echo "  just \033[0;33msetup\033[0m                    \033[0;32mRun setup with local binary\033[0m"
    @echo "  just \033[0;33msetup-test\033[0m               \033[0;32mRun setup in fresh tmp dir\033[0m"
    @echo ""
    @echo ""
    @echo ""
    @echo ""

# ============================================================================
# Development Commands
# ============================================================================
import 'justfiles/development/dev.just'
import 'justfiles/development/docs.just'

# ============================================================================
# Building Commands
# ============================================================================
import 'justfiles/building/build.just'
import 'justfiles/building/build-release.just'

# ============================================================================
# Verification Commands
# ============================================================================
import 'justfiles/verification/check.just'
import 'justfiles/verification/clippy.just'
import 'justfiles/verification/fmt.just'
import 'justfiles/verification/fmt-check.just'
import 'justfiles/verification/docs-sync-check.just'

# ============================================================================
# Utilities Commands
# ============================================================================
import 'justfiles/utilities/clean.just'
import 'justfiles/utilities/install.just'
import 'justfiles/utilities/uninstall.just'
import 'justfiles/utilities/docs-gh-pub.just'
import 'justfiles/utilities/pub.just'
import 'justfiles/utilities/setup.just'
import 'justfiles/utilities/setup-test.just'
