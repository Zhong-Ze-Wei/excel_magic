#!/bin/bash
# PreToolUse hook: git commit 时检测架构敏感改动，提醒自检 ADR
# 设计原则：只提醒，不阻塞（exit 0）。最终判断由人完成。
# 与 prevent-master-commit.sh 共用 stdin 解析模式。

INPUT=$(cat)
CMD=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.command||'')}catch(e){console.log('')}})" 2>/dev/null || echo "")

# 只在 git commit 时触发
if ! echo "$CMD" | grep -qE "^git commit"; then
  exit 0
fi

# master 上的 commit 由 prevent-master-commit.sh 拦截，这里不重复提示
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ "$BRANCH" = "master" ] || [ -z "$BRANCH" ]; then
  exit 0
fi

# 检查暂存区是否触及架构敏感文件
# 触发条件：stores/ 全量、services 核心引擎、composables、router、ADR 目录本身
ARCH_SENSITIVE=$(git diff --cached --name-only 2>/dev/null | grep -E '^(app/src/stores/|app/src/services/(cleaningRules|ai|prompts|dataProfiler)|app/src/composables/|app/src/router/|docs/adr/)' || true)

if [ -n "$ARCH_SENSITIVE" ]; then
  echo "[ADR 自检] 本次 commit（分支 $BRANCH）触及架构敏感文件：" >&2
  echo "$ARCH_SENSITIVE" | sed 's/^/  - /' >&2
  echo "" >&2
  echo "请对照 CLAUDE.md「ADR 触发清单」自检：" >&2
  echo "  命中 → 在 docs/adr/ 补一份 ADR 再合并；不命中 → 忽略本提醒。" >&2
fi

exit 0
