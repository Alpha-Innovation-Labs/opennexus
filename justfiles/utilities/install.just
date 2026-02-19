# Install opennexus globally
# Usage: just install
# Example: just install

install:
    @echo "Installing opennexus globally..."
    cargo install --path . --bin opennexus --force
    @echo "Installation complete!"
    @echo "  - Run 'opennexus --help' for CLI help"
    @echo "  - Run 'opennexus setup' to extract .nexus assets"
