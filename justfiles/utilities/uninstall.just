# Uninstall nexus globally
# Usage: just uninstall
# Example: just uninstall

uninstall:
    @echo "Uninstalling nexus..."
    cargo uninstall -p nexus-cli
    @echo "Uninstall complete!"
