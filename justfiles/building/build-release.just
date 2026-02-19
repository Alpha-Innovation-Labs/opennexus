# Build release binary
# Usage: just build-release
# Example: just build-release

build-release:
    @echo "📦 Building release binary..."
    cargo build --release
    @codesign -s - target/release/opennexus 2>/dev/null || true
    @echo "✅ Build complete!"
