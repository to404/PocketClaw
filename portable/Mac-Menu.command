#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_menu() {
    clear
    echo "╔══════════════════════════════════════╗"
    echo "║        PocketClaw 管理菜单           ║"
    echo "╠══════════════════════════════════════╣"
    echo "║  1. 启动PocketClaw                  ║"
    echo "║  2. 检查更新                         ║"
    echo "║  3. 重新初始化 (setup)               ║"
    echo "║  4. 查看版本信息                     ║"
    echo "║  5. 打开数据目录                     ║"
    echo "║  0. 退出                             ║"
    echo "╚══════════════════════════════════════╝"
    echo ""
    echo -n "请选择 [0-5]: "
}

while true; do
    show_menu
    read -r choice

    case "$choice" in
        1)
            echo "正在启动..."
            bash "$SCRIPT_DIR/Mac-Start.command"
            ;;
        2)
            echo "正在检查更新..."
            bash "$SCRIPT_DIR/system/update.sh"
            echo ""
            echo "按 Enter 返回菜单"
            read -r
            ;;
        3)
            echo "正在重新初始化..."
            bash "$SCRIPT_DIR/system/setup.sh"
            echo ""
            echo "按 Enter 返回菜单"
            read -r
            ;;
        4)
            echo ""
            echo "产品版本: v$(cat "$SCRIPT_DIR/version.txt" 2>/dev/null || echo 'unknown')"
            echo "数据目录: $SCRIPT_DIR/data"
            echo ""
            echo "按 Enter 返回菜单"
            read -r
            ;;
        5)
            open "$SCRIPT_DIR/data"
            ;;
        0)
            echo "再见！"
            exit 0
            ;;
        *)
            echo "无效选项，请重试"
            sleep 1
            ;;
    esac
done
