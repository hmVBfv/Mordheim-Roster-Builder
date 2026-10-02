#!/usr/bin/env bash
# ops/ddns/porkbun-ddns against a stand-in for the Porkbun API on localhost:
# a record that is right is left alone, a wrong one is edited, a missing one
# created; a refused key or an HTML error page fails loudly and changes
# nothing. Needs python3, curl, jq; no root. Run by CI; locally:
# ops/test/ddns.sh
#
# Regression (Rob, 02.10.2026): Debian's ddclient called porkbun.com instead
# of api.porkbun.com and got an HTML 403 – the updater must say so, not pass.
set -euo pipefail

src=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
failures=0
cleanup() { [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null; rm -rf "$work"; }
trap cleanup EXIT

cat >"$work/fake.py" <<'PY'
import json, sys, os
from http.server import BaseHTTPRequestHandler, HTTPServer
state = sys.argv[1]
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def reply(self, code, body, ctype='application/json'):
        b = body.encode()
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        st = json.load(open(state))
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        st['calls'].append(self.path)
        if st.get('html'):
            json.dump(st, open(state, 'w')); return self.reply(403, '<html>403 Forbidden</html>', 'text/html')
        if body.get('apikey') != 'pk1_test' or body.get('secretapikey') != 'sk1_test':
            json.dump(st, open(state, 'w')); return self.reply(400, json.dumps({'status': 'ERROR', 'message': 'Invalid API key. (002)'}))
        p = self.path.split('/')[1:]  # ['ping'] | ['dns', op, domain, (type, name)]
        out = {'status': 'SUCCESS'}
        if p == ['ping']: out['yourIp'] = st['ip']
        elif p[1] == 'retrieveByNameType':
            c = st['records'].get(p[4]); out['records'] = [{'name': p[4] + '.' + p[2], 'type': 'A', 'content': c, 'ttl': '600'}] if c else []
        elif p[1] == 'editByNameType': st['records'][p[4]] = body['content']; st['edits'].append(p[4])
        elif p[1] == 'create': st['records'][body['name']] = body['content']; st['edits'].append(body['name'])
        json.dump(st, open(state, 'w')); self.reply(200, json.dumps(out))
s = HTTPServer(('127.0.0.1', 0), H)
print(s.server_port, flush=True)
s.serve_forever()
PY

state() { printf '%s' "$1" >"$work/state.json"; }
q() { jq -r "$1" "$work/state.json"; }
expect() { # expect <what> <command...>
  if "${@:2}"; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}

state '{"ip":"203.0.113.7","records":{},"calls":[],"edits":[]}'
python3 "$work/fake.py" "$work/state.json" >"$work/port" &
pid=$!
for _ in $(seq 50); do [ -s "$work/port" ] && break; sleep 0.1; done
PORKBUN_API="http://127.0.0.1:$(cat "$work/port")"
export PORKBUN_API PORKBUN_API_KEY=pk1_test PORKBUN_SECRET_KEY=sk1_test DOMAIN=example.org HOSTS="mordheim ts"
run() { "$src/ddns/porkbun-ddns" >"$work/out" 2>"$work/err"; }
fails() { ! run; }

state '{"ip":"203.0.113.7","records":{"mordheim":"203.0.113.7","ts":"203.0.113.7"},"calls":[],"edits":[]}'
expect "records already right: success" run
expect "records already right: nothing changed" test "$(q '.edits | length')" = 0
expect "records already right: nothing printed" test ! -s "$work/out"

state '{"ip":"203.0.113.7","records":{"mordheim":"198.51.100.1"},"calls":[],"edits":[]}'
expect "a new IP: success" run
expect "the wrong record is edited, the missing one created" test "$(q '.records.mordheim + " " + .records.ts')" = "203.0.113.7 203.0.113.7"
expect "a new IP: the edited record is printed" grep -qx 'mordheim.example.org: 198.51.100.1 -> 203.0.113.7' "$work/out"
expect "a new IP: the created record is printed" grep -qx 'ts.example.org: none -> 203.0.113.7' "$work/out"

state '{"ip":"203.0.113.9","records":{"mordheim":"198.51.100.1"},"calls":[],"edits":[]}'
PORKBUN_SECRET_KEY=sk1_wrong expect "a refused key fails" fails
expect "a refused key: Porkbun's message reaches the log" grep -q '^ping: Invalid API key' "$work/err"
expect "a refused key: nothing changed" test "$(q '.edits | length')" = 0

state '{"ip":"203.0.113.9","records":{},"calls":[],"edits":[],"html":true}'
expect "an HTML 403 fails" fails
expect "an HTML 403 is named, not passed over" grep -q 'not JSON' "$work/err"

state '{"ip":"203.0.113.7","records":{},"calls":[],"edits":[]}'
HOSTS="ok bad;name" expect "a host name that is not one fails" fails
expect "a host name that is not one: refused before any call" test "$(q '.calls | length')" = 0

[ "$failures" -eq 0 ] || { echo "$failures check(s) failed"; exit 1; }
echo "all DynDNS checks passed"
