#!/bin/bash
# scripts/dev.sh
# Start Services and Dev Server on Linux/macOS

echo -e "\033[0;36mStarting Local Services...\033[0m"

# Function to check if a service is running via systemctl
check_service() {
    if systemctl is-active --quiet "$1"; then
        echo -e "$2 is \033[0;32m[RUNNING]\033[0m"
        return 0
    else
        echo -e "$2 is \033[0;31m[NOT RUNNING]\033[0m"
        return 1
    fi
}

# Ensure Apache is running
if ! check_service "apache2" "Apache" && ! check_service "nginx" "Nginx"; then
    echo "Attempting to start Apache..."
    sudo systemctl start apache2 || echo "Could not start an HTTP server. Please start your local web server manually."
fi

# Ensure MySQL/MariaDB is running
if ! check_service "mysql" "MySQL" && ! check_service "mariadb" "MariaDB"; then
    echo "Attempting to start Database..."
    sudo systemctl start mysql || sudo systemctl start mariadb || echo "Could not start Database. Please start your local DB server manually."
fi

echo -e "\n\033[0;36mStarting Dev Server (bun start)...\033[0m"
bun start
