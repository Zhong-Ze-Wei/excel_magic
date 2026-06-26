#!/bin/bash
# PostToolUse hook: git merge 后提醒审查是否需要写 ADR（合并级总盘点）
# 只在 merge 命令执行后触发，且仅当合并引入了架构敏感文件时提示，减少噪声。

INPUT=$(cat)
CMD=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.command||'')}catch(e){console.log('')}})" 2>/dev/null || echo "")

# 只在 git merge 时触发
if ! echo "$CMD" | grep -qE "^git merge "; then
  exit 0
fi

# 检查本次合并引入的架构敏感文件（HEAD vs HEAD~1，适用于 --no-ff 合并）
MERGE_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E '^(app/src/stores/|app/src/services/(cleaningRules|ai|prompts|dataProfiler)|app/src/composables/|app/src/router/|docs/adr/)' || true)

if [ -n "$MERGE_FILES" ]; then
  echo "[ADR Hook] 本次合并引入了架构层文件改动："
  echo "$MERGE_FILES" | sed 's/^/  - /'
  echo ""
  echo "请审查本次合并是否包含架构层面的 trade-off 决策——有利有弊才值得写 ADR。"
  echo "如果是，运行 /adr-check 并在 docs/adr/ 补一份 ADR。"
fi

exit 0
