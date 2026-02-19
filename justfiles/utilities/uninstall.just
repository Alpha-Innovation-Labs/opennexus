# Uninstall nexus globally
# Usage: just uninstall
# Example: just uninstall

uninstall:
    @echo "Uninstalling nexus..."
    cargo uninstall opennexus
    @echo "Uninstall complete!"
