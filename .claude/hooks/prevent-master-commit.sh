#!/bin/bash
# PreToolUse hook: 拦截在 master 分支上的 git commit
# exit 2 = 阻止工具调用

INPUT=$(cat)
CMD=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.command||'')}catch(e){console.log('')}})" 2>/dev/null || echo "")

# 只拦截 git commit 命令
if echo "$CMD" | grep -qE "^git commit"; then
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
  if [ "$BRANCH" = "master" ]; then
    echo "[BLOCKED] 当前在 master 分支，禁止直接 commit。请先 git checkout -b <type>/<name>" >&2
    exit 2
  fi
fi
