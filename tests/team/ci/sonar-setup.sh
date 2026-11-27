#!/usr/bin/env bash
# Prepares the throwaway SonarQube service container in CI:
#   1. waits until it is UP,
#   2. replaces the default admin password,
#   3. creates our quality gate and makes it the default,
#   4. writes an analysis token to $GITHUB_ENV as SONAR_TOKEN.
# Every CI run starts a fresh container, so SonarQube's default "new code" conditions never apply.
# Our gate therefore uses conditions on OVERALL code of the in-scope files.
set -euo pipefail
URL=${SONAR_URL:-http://localhost:9000}
# SonarQube requires upper case, lower case, a digit and a special character.
PASS="Ci-$(openssl rand -hex 12)!Q"

# The container refuses connections while it boots. A failed check inside an "until" condition does
# not stop the script under "set -e"; it just tries again.
tries=0
until curl -s "$URL/api/system/status" | grep -q '"status":"UP"'; do
  tries=$((tries + 1))
  if [ "$tries" -ge 100 ]; then echo "SonarQube did not start"; exit 1; fi
  sleep 3
done

curl -sSf -u admin:admin -X POST "$URL/api/users/change_password" \
  --data-urlencode "login=admin" --data-urlencode "previousPassword=admin" --data-urlencode "password=$PASS"
A="admin:$PASS"
GATE="SE3002 gate"
curl -sSf -u "$A" -X POST "$URL/api/qualitygates/create" --data-urlencode "name=$GATE" > /dev/null

# Gate conditions. Thresholds are justified in the test plan (Section 2.2) and tightened in step 2.8.
#   security_rating    > 1 (worse than A) fails: the in-scope baseline is A, so any new vulnerability fails.
#   reliability_rating > 3 (worse than C) fails: the in-scope baseline is C (19 upstream bugs); no regression allowed.
cond() {
  curl -sSf -u "$A" -X POST "$URL/api/qualitygates/create_condition" \
    --data-urlencode "gateName=$GATE" --data-urlencode "metric=$1" \
    --data-urlencode "op=GT" --data-urlencode "error=$2" > /dev/null
}
cond security_rating 1
cond reliability_rating 3
curl -sSf -u "$A" -X POST "$URL/api/qualitygates/set_as_default" --data-urlencode "name=$GATE"

TOKEN=$(curl -sSf -u "$A" -X POST "$URL/api/user_tokens/generate" \
  --data-urlencode "name=ci" --data-urlencode "type=GLOBAL_ANALYSIS_TOKEN" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "::add-mask::$TOKEN"
echo "SONAR_TOKEN=$TOKEN" >> "$GITHUB_ENV"
echo "SonarQube ready; quality gate '$GATE' is the default."
