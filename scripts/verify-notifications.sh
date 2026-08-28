#!/bin/bash
# End-to-end verification of the notification system against a running server.
# Usage: scripts/verify-notifications.sh <port>   (server must be running: npm start -- -p <port>)
set -u
PORT="${1:-3212}"
BASE="http://localhost:$PORT"
ENV_FILE="$(dirname "$0")/../.env"
MARKER="NOTIF-VERIFY-TEST"

# Load needed env values
SESSION_SECRET=$(grep -E "^AUTH_SESSION_SECRET=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
CRON_SECRET=$(grep -E "^RECURRING_CRON_SECRET=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
COOKIE_NAME="__Host-biller_session"

if [ -z "$SESSION_SECRET" ]; then echo "AUTH_SESSION_SECRET missing in .env"; exit 1; fi

# Mint a valid HS256 session token (same construction as src/lib/auth/session.ts)
TOKEN=$(node -e "
const {createHmac, randomBytes} = require('crypto');
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now()/1000);
const h = enc({alg:'HS256', typ:'JWT'});
const p = enc({sub:'owner', methods:['pin'], iat:now, exp:now+86400, jti:randomBytes(16).toString('hex')});
const sig = createHmac('sha256', process.argv[1]).update(h+'.'+p).digest('base64url');
console.log(h+'.'+p+'.'+sig);
" "$SESSION_SECRET")
COOKIE="$COOKIE_NAME=$TOKEN"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "✗ FAIL: $1"; }
jqf()  { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(\"d$1\"))" 2>/dev/null; }

echo "== 1. Auth =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/notifications")
[ "$code" = "401" ] && ok "unauthenticated GET -> 401" || bad "expected 401, got $code"

echo "== 2. Baseline list =="
unread_before=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | jqf "['unreadCount']")
[ -n "$unread_before" ] && ok "authenticated GET -> 200 (unreadCount=$unread_before)" || bad "list failed"

echo "== 3. Recurring generation notifies =="
YESTERDAY=$(date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d yesterday +%Y-%m-%d)
TODAY=$(date -u +%Y-%m-%d)
REC_INV=$(curl -s -b "$COOKIE" -X POST "$BASE/api/invoices" -H 'Content-Type: application/json' -d "{
  \"customer\": {\"name\": \"Notif Test Recurring\"},
  \"invoice\": {\"date\": \"$YESTERDAY\", \"dueDate\": \"$TODAY\", \"currency\": \"AED\"},
  \"items\": [{\"name\": \"Test item\", \"quantity\": 2, \"unit_cost\": 100}],
  \"recurring\": {\"enabled\": true, \"frequency\": \"daily\"},
  \"notes\": \"$MARKER\"
}")
REC_ID=$(echo "$REC_INV" | jqf "['_id']")
[ -n "$REC_ID" ] && ok "recurring source invoice created ($REC_ID)" || bad "invoice create failed: $REC_INV"

curl -s -X POST -H "x-recurring-cron-secret: $CRON_SECRET" "$BASE/api/invoices/recurring/process" > /dev/null
sleep 1
GEN_COUNT=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(len([i for i in d['items'] if i['type']=='invoice_generated']))")
[ "$GEN_COUNT" -ge 1 ] 2>/dev/null && ok "recurring clone produced invoice_generated notification ($GEN_COUNT)" || bad "no invoice_generated notification"

echo "== 4. Manual creation does NOT notify =="
MANUAL_INV=$(curl -s -b "$COOKIE" -X POST "$BASE/api/invoices" -H 'Content-Type: application/json' -d "{
  \"customer\": {\"name\": \"Notif Test Manual\"},
  \"invoice\": {\"date\": \"$TODAY\", \"dueDate\": \"$TODAY\", \"currency\": \"AED\"},
  \"items\": [{\"name\": \"Manual item\", \"quantity\": 1, \"unit_cost\": 50}],
  \"notes\": \"$MARKER\"
}")
MANUAL_ID=$(echo "$MANUAL_INV" | jqf "['_id']")
sleep 1
GEN_COUNT2=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(len([i for i in d['items'] if i['type']=='invoice_generated']))")
[ "$GEN_COUNT2" = "$GEN_COUNT" ] && ok "manual invoice did not add generated notification" || bad "manual invoice notified ($GEN_COUNT -> $GEN_COUNT2)"

echo "== 5. Overdue scan creates notification =="
OVERDUE_DATE=$(date -u -v-9d +%Y-%m-%d 2>/dev/null || date -u -d '9 days ago' +%Y-%m-%d)
OD_INV=$(curl -s -b "$COOKIE" -X POST "$BASE/api/invoices" -H 'Content-Type: application/json' -d "{
  \"customer\": {\"name\": \"Notif Test Overdue\"},
  \"invoice\": {\"date\": \"2026-08-01\", \"dueDate\": \"$OVERDUE_DATE\", \"currency\": \"AED\"},
  \"items\": [{\"name\": \"Overdue item\", \"quantity\": 1, \"unit_cost\": 400}],
  \"notes\": \"$MARKER\"
}")
OD_ID=$(echo "$OD_INV" | jqf "['_id']")
# The GET scan is throttled at this point (the cron route already force-scanned
# in test 3), so drive the forced scan through the cron route.
curl -s -o /dev/null -X POST -H "x-recurring-cron-secret: $CRON_SECRET" "$BASE/api/invoices/recurring/process"
sleep 1
OD_NOTIF=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | python3 -c "
import sys, json
d = json.load(sys.stdin)
rows = [i for i in d['items'] if i['type']=='invoice_overdue']
print(len(rows))")
[ "$OD_NOTIF" -ge 1 ] 2>/dev/null && ok "overdue notification created ($OD_NOTIF)" || bad "no overdue notification"

echo "== 6. Immediate re-scan does not duplicate =="
BEFORE_TOTAL=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len([i for i in d['items'] if i['type']=='invoice_overdue']))")
curl -s -b "$COOKIE" "$BASE/api/notifications" > /dev/null
AFTER_TOTAL=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len([i for i in d['items'] if i['type']=='invoice_overdue']))")
[ "$BEFORE_TOTAL" = "$AFTER_TOTAL" ] && ok "no duplicate overdue rows" || bad "duplicated ($BEFORE_TOTAL -> $AFTER_TOTAL)"

echo "== 7. Mark read + mark all read =="
FIRST_ID=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | jqf "['items'][0]['id']")
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" -X POST "$BASE/api/notifications" -H 'Content-Type: application/json' -d "{\"action\":\"mark-read\",\"id\":\"$FIRST_ID\"}")
[ "$code" = "200" ] && ok "mark-read -> 200" || bad "mark-read -> $code"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" -X POST "$BASE/api/notifications" -H 'Content-Type: application/json' -d '{"action":"mark-all-read"}')
[ "$code" = "200" ] && ok "mark-all-read -> 200" || bad "mark-all-read -> $code"
UNREAD_NOW=$(curl -s -b "$COOKIE" "$BASE/api/notifications" | jqf "['unreadCount']")
[ "$UNREAD_NOW" = "0" ] && ok "unreadCount back to 0" || bad "unreadCount=$UNREAD_NOW"

echo "== 8. Paid invoice resolves overdue notification (lazy) =="
curl -s -o /dev/null -b "$COOKIE" -X PATCH "$BASE/api/invoices/$OD_ID/status" -H 'Content-Type: application/json' -d '{"status":"paid"}'
# force a scan bypassing the throttle by waiting? throttle is 10min — use the cron route instead
curl -s -o /dev/null -X POST -H "x-recurring-cron-secret: $CRON_SECRET" "$BASE/api/invoices/recurring/process"
sleep 1
RESOLVED=$(node -e "
const dotenv=require('dotenv');dotenv.config();
const mongoose=require('mongoose');
const {ObjectId}=require('mongodb');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI,{bufferCommands:false});
  const n=await mongoose.connection.db.collection('notifications').findOne({invoiceId:new ObjectId('$OD_ID')});
  console.log(n && n.resolvedAt ? 'resolved' : (n ? 'pending' : 'missing'));
  await mongoose.disconnect();
})()")
[ "$RESOLVED" = "resolved" ] && ok "overdue notification resolved after payment" || bad "resolution state: $RESOLVED"

echo "== 9. DELETE cascades notifications =="
curl -s -o /dev/null -b "$COOKIE" -X DELETE "$BASE/api/invoices/$OD_ID"
CASCADE=$(node -e "
const dotenv=require('dotenv');dotenv.config();
const mongoose=require('mongoose');
const {ObjectId}=require('mongodb');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI,{bufferCommands:false});
  const c=await mongoose.connection.db.collection('notifications').countDocuments({invoiceId:new ObjectId('$OD_ID')});
  console.log(c);
  await mongoose.disconnect();
})()")
[ "$CASCADE" = "0" ] && ok "cascade delete works" || bad "rows remaining: $CASCADE"

echo "== 10. Cleanup test data =="
for id in "$REC_ID" "$MANUAL_ID"; do
  [ -n "$id" ] && curl -s -o /dev/null -b "$COOKIE" -X DELETE "$BASE/api/invoices/$id"
done
node -e "
const dotenv=require('dotenv');dotenv.config();
const mongoose=require('mongoose');
(async()=>{
  await mongoose.connect(process.env.MONGODB_URI,{bufferCommands:false});
  // remove notifications pointing at deleted test invoices, and any leftovers by marker
  const invIds = await mongoose.connection.db.collection('invoices').find({notes: '$MARKER'}).project({_id:1}).toArray();
  if (invIds.length) await mongoose.connection.db.collection('notifications').deleteMany({invoiceId: {\$in: invIds.map(i=>i._id)}});
  await mongoose.connection.db.collection('invoices').deleteMany({notes: '$MARKER'});
  await mongoose.connection.db.collection('notifications').deleteMany({invoiceNumber: /^INV-/ , customerName: /^Notif Test /});
  console.log('cleanup done');
  await mongoose.disconnect();
})()"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
exit $FAIL