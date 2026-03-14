#!/bin/bash
# scripts/stop.sh
# Stop Services on Linux/macOS

echo -e "\033[0;36mShutting down Local Services...\033[0m"

sudo systemctl stop apache2 nginx 2>/dev/null
echo -e "Web server service \033[0;32m[STOPPED]\033[0m"

sudo systemctl stop mysql mariadb 2>/dev/null
echo -e "Database service \033[0;32m[STOPPED]\033[0m"

echo -e "\033[0;36mCleanup complete.\033[0m"
