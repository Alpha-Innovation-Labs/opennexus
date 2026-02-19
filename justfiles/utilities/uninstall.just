# Uninstall opennexus globally
# Usage: just uninstall
# Example: just uninstall

uninstall:
    @echo "Uninstalling opennexus..."
    cargo uninstall --package opennexus --bin opennexus
    @echo "Uninstall complete!"
