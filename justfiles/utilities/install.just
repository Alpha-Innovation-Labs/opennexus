# Install nexus globally
# Usage: just install
# Example: just install

install:
    @echo "Installing nexus globally..."
    cargo install --path . --force
    @echo "Installation complete!"
    @echo "  - Run 'nexus --help' for CLI help"
    @echo "  - Run 'nexus setup' to extract .nexus assets"
