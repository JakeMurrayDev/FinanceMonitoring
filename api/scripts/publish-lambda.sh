#!/usr/bin/env bash
# Build the API for AWS Lambda's OS-only runtime (provided.al2023).
#
#   self-contained  The .NET 11 runtime ships inside the package, because
#                   Lambda has no managed .NET 11 runtime.
#   ReadyToRun      Code is precompiled to native, so a cold start JIT-compiles
#                   far less. (Native AOT would be faster still, but EF Core's
#                   AOT support is experimental and can't run dynamic queries.)
#   arm64           Graviton: cheaper per GB-second than x86.
#
# Usage: api/scripts/publish-lambda.sh [runtime-id]   (default linux-arm64)
set -euo pipefail

RID="${1:-linux-arm64}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/artifacts/lambda"

rm -rf "$OUT"
dotnet publish "$ROOT/src/FinanceMonitoring.Api" \
  --configuration Release \
  --runtime "$RID" \
  --self-contained true \
  -p:PublishReadyToRun=true \
  -p:OpenApiGenerateDocuments=false \
  --output "$OUT"

# Lambda's OS-only runtime starts an executable called "bootstrap".
cat > "$OUT/bootstrap" <<'SH'
#!/bin/sh
set -e
cd "$(dirname "$0")"
exec ./FinanceMonitoring.Api "$@"
SH
chmod +x "$OUT/bootstrap" "$OUT/FinanceMonitoring.Api"

echo "Published $RID to $OUT ($(du -sh "$OUT" | cut -f1) unzipped)"
