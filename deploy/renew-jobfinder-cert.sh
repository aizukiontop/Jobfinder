#!/bin/sh
set -eu

umask 077

domain='jobfinder.47-236-129-80.sslip.io'
lego='/opt/jobfinder-public/bin/lego'
lego_state='/var/lib/jobfinder-letsencrypt'
webroot='/var/lib/jobfinder-nginx/acme'
challenge_dir='/var/lib/jobfinder-nginx/acme/.well-known/acme-challenge'
tls_root='/etc/jobfinder-nginx/tls'
nginx_prefix='/var/lib/jobfinder-nginx/'
nginx_config='/etc/jobfinder-nginx/nginx.conf'
api_unit='jobfinder-api.service'
nginx_unit='jobfinder-nginx.service'

restart_api() {
    # The renewal service intentionally pauses only JobFinder's API. Always
    # bring it back, regardless of ACME, certificate, or reload failures.
    /usr/bin/systemctl start "$api_unit" || true
}

exit_on_signal() {
    exit 1
}

fail() {
    echo "jobfinder certificate renewal: $*" >&2
    exit 1
}

test -x "$lego" || fail "missing executable $lego"
test -d "$lego_state" || fail "missing state directory $lego_state"
test -d "$webroot" || fail "missing ACME webroot $webroot"
test -d "$challenge_dir" || fail "missing challenge directory $challenge_dir"
test "$(/usr/bin/stat -c '%U:%G:%a' "$challenge_dir")" = 'root:jobfinder-web:2750' \
    || fail "unsafe challenge-directory ownership or mode"
test -f "$nginx_config" || fail "missing isolated Nginx configuration"

# HTTP-01 depends on the isolated port-80 listener. Never invoke or inspect the
# system nginx.service from this workflow.
/usr/bin/systemctl is-active --quiet "$nginx_unit" || fail "$nginx_unit is not active"
/usr/sbin/nginx -t -q -p "$nginx_prefix" -c "$nginx_config"

# Avoid stopping the API or starting lego when the current, correctly named
# certificate is valid for more than another 21 days. Missing, malformed, or
# mismatched certificates proceed through normal first-issuance/renewal.
current_cert="$tls_root/current/fullchain.pem"
if test -s "$current_cert" && \
    /usr/bin/openssl x509 -in "$current_cert" -noout -checkhost "$domain" >/dev/null 2>&1 && \
    /usr/bin/openssl x509 -in "$current_cert" -noout -checkend 1814400 >/dev/null 2>&1; then
    echo "jobfinder certificate renewal: current certificate has more than 21 days remaining"
    exit 0
fi

trap restart_api EXIT
trap exit_on_signal HUP INT TERM
/usr/bin/systemctl stop "$api_unit"

(
    # The setgid challenge directory supplies jobfinder-web as the group;
    # this scoped umask makes lego's token group-readable without weakening
    # the renewal service's global secret-file umask.
    umask 0027
    "$lego" run \
        --server https://acme-v02.api.letsencrypt.org/directory \
        --path "$lego_state" \
        --accept-tos \
        --domains "$domain" \
        --key-type EC256 \
        --http \
        --http.webroot "$webroot" \
        --renew-days 21 \
        --no-random-sleep
)

cert_source="$lego_state/certificates/$domain.crt"
key_source="$lego_state/certificates/$domain.key"

test -s "$cert_source" || fail "lego did not produce $cert_source"
test -s "$key_source" || fail "lego did not produce $key_source"

/usr/bin/openssl x509 -in "$cert_source" -noout -checkhost "$domain" >/dev/null
/usr/bin/openssl x509 -in "$cert_source" -noout -checkend 604800 >/dev/null
/usr/bin/openssl pkey -in "$key_source" -noout -check >/dev/null

stamp=$(/usr/bin/date -u +%Y%m%dT%H%M%SZ)
release_dir="$tls_root/releases/$stamp"
/usr/bin/install -d -o root -g root -m 0700 "$release_dir"
/usr/bin/install -o root -g root -m 0644 "$cert_source" "$release_dir/fullchain.pem"
/usr/bin/install -o root -g root -m 0600 "$key_source" "$release_dir/privkey.pem"

# Compare the public keys before making this certificate pair current.
/usr/bin/openssl x509 -in "$release_dir/fullchain.pem" -pubkey -noout > "$release_dir/cert-public.pem"
/usr/bin/openssl pkey -in "$release_dir/privkey.pem" -pubout > "$release_dir/key-public.pem"
/usr/bin/cmp -s "$release_dir/cert-public.pem" "$release_dir/key-public.pem" || fail "certificate and private key do not match"
/usr/bin/rm -f "$release_dir/cert-public.pem" "$release_dir/key-public.pem"

current_link="$tls_root/.current-$stamp"
/usr/bin/ln -s "$release_dir" "$current_link"
/usr/bin/mv -Tf "$current_link" "$tls_root/current"

# Validate exactly the isolated configuration, then reload exactly its service.
# A failed validation leaves the running Nginx process untouched.
/usr/sbin/nginx -t -q -p "$nginx_prefix" -c "$nginx_config"
/usr/bin/systemctl reload "$nginx_unit"
