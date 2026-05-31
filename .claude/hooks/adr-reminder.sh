#!/bin/bash
# PostToolUse hook: git merge 后提醒审查是否需要写 ADR

INPUT=$(cat)
CMD=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.command||'')}catch(e){console.log('')}})" 2>/dev/null || echo "")

if echo "$CMD" | grep -qE "^git merge "; then
  echo "[ADR Hook] 分支合并完成。请审查本次合并是否包含架构层面的 trade-off 决策——有利有弊才值得写 ADR。如果是，运行 /adr-check。"
fi
