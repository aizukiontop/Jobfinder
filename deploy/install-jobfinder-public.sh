#!/bin/bash
set -Eeuo pipefail

# One-shot installer for the temporary public JobFinder preview.
#
# Run this file as root from an extracted release whose layout is:
#   web/       locally built Vite output
#   deploy/    the isolated Nginx and systemd artifacts
#   lego       verified Linux amd64 lego v5.3.1 binary
#
# A first deployment uses no arguments. If a prior run stopped immediately
# after install_files, use --resume-after-install. Resume mode verifies every
# retained artifact before making any further change; it never reruns the file
# or account installation stage.
#
# This installer deliberately never starts, stops, enables, disables, reloads,
# or reconfigures nginx.service. It also never writes to any IGST path.

umask 077
export LC_ALL=C

readonly DOMAIN='jobfinder.47-236-129-80.sslip.io'
readonly PUBLIC_IP='47.236.129.80'
readonly API_UNIT='jobfinder-api.service'
readonly EDGE_UNIT='jobfinder-nginx.service'
readonly RENEW_UNIT='jobfinder-cert-renew.service'
readonly RENEW_TIMER='jobfinder-cert-renew.timer'
readonly GLOBAL_NGINX_UNIT='nginx.service'
readonly MYSQL_UNIT='mysql.service'
readonly WEB_USER='jobfinder-web'
readonly WEB_GROUP='jobfinder-web'
readonly API_PORT='3210'
readonly EDGE_MEMORY_CAP_MIB='16'
readonly STEADY_MEMORY_LIMIT_MIB='80'
readonly MAX_REPLICA_LAG_SECONDS='5'

readonly EXPECTED_IGST_SERVICE_SHA256='ebdddcec85779e5e6ae972df0627129ac0ecf303ce910aaea53f46ed19d1979b'
readonly EXPECTED_IGST_NGINX_SHA256='14f401f025f862f097111843c14cc48439d955defdabb9d66b398c96a86c8779'
readonly EXPECTED_LEGO_SHA256='36c97b1ed369c2c46d7a4dde0d635d8e742b080c27c36d58933a8029f7811624'
readonly EXPECTED_LEGACY_RENEW_SCRIPT_SHA256='90024b3a0cb4675654e283e91684df867a3b8beaa255be95d2bdd593d89a9128'

readonly PROTECTED_IGST_SERVICE='/etc/systemd/system/igstprem.service'
readonly PROTECTED_IGST_SITE_AVAILABLE='/etc/nginx/sites-available/igstprem'
readonly PROTECTED_IGST_SITE_ENABLED='/etc/nginx/sites-enabled/igstprem'
readonly REPLICA_CHECK='/usr/local/sbin/igst-replica-check'

readonly API_ROOT='/opt/jobfinder'
readonly PUBLIC_ROOT='/opt/jobfinder-public'
readonly WEB_ROOT='/opt/jobfinder-public/web'
readonly BIN_ROOT='/opt/jobfinder-public/bin'
readonly API_ENV='/etc/jobfinder/jobfinder.env'
readonly EDGE_CONFIG_ROOT='/etc/jobfinder-nginx'
readonly EDGE_CONFIG='/etc/jobfinder-nginx/nginx.conf'
readonly EDGE_SITE='/etc/jobfinder-nginx/site.conf'
readonly TLS_ROOT='/etc/jobfinder-nginx/tls'
readonly EDGE_STATE='/var/lib/jobfinder-nginx'
readonly ACME_WEBROOT='/var/lib/jobfinder-nginx/acme'
readonly LEGO_STATE='/var/lib/jobfinder-letsencrypt'
readonly LEGO_STAGING_STATE='/var/lib/jobfinder-letsencrypt/staging'
readonly INSTALLED_LEGO='/opt/jobfinder-public/bin/lego'
readonly INSTALLED_RENEW_SCRIPT='/opt/jobfinder-public/bin/renew-jobfinder-cert.sh'

readonly SCRIPT_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd -P)"
readonly RELEASE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
readonly WEB_SOURCE="$RELEASE_ROOT/web"
readonly DEPLOY_SOURCE="$RELEASE_ROOT/deploy"
readonly LEGO_SOURCE="$RELEASE_ROOT/lego"

API_PAUSED=0
MUTATIONS_STARTED=0
EDGE_STARTED=0
EDGE_ENABLED=0
TIMER_ENABLED=0
UFW80_ADDED=0
UFW443_ADDED=0
ENV_CHANGED=0
ENV_BACKUP=''
RENEW_UNIT_UPDATE_NEEDED=0
EDGE_STATE_MIGRATION_NEEDED=0
EDGE_RESET_FAILED_NEEDED=0
EDGE_UNIT_UPDATE_NEEDED=0
ACME_DIR_MIGRATION_NEEDED=0
RENEW_SCRIPT_UPDATE_NEEDED=0
VERIFIED_ACME_RESIDUE=''
ACTIVE_CHALLENGE_FILE=''

log() {
    printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
    log "ERROR: $*" >&2
    return 1
}

restore_api() {
    if (( API_PAUSED == 1 )); then
        log "Restoring only $API_UNIT"
        if systemctl start "$API_UNIT"; then
            API_PAUSED=0
        else
            log "ERROR: failed to restore $API_UNIT" >&2
            return 1
        fi
    fi
}

on_exit() {
    local rc=$?
    trap - EXIT HUP INT TERM

    if [[ -n "$ACTIVE_CHALLENGE_FILE" \
        && "$ACTIVE_CHALLENGE_FILE" == "$ACME_WEBROOT/.well-known/acme-challenge/installer-preflight-"* \
        && -f "$ACTIVE_CHALLENGE_FILE" && ! -L "$ACTIVE_CHALLENGE_FILE" ]]; then
        rm -f -- "$ACTIVE_CHALLENGE_FILE" || true
        ACTIVE_CHALLENGE_FILE=''
    fi

    if ! restore_api; then
        rc=1
    fi

    if (( rc != 0 && MUTATIONS_STARTED == 1 )); then
        log 'Deployment failed; disabling only newly introduced JobFinder public components.' >&2

        if (( TIMER_ENABLED == 1 )); then
            systemctl disable --now "$RENEW_TIMER" >/dev/null 2>&1 || true
        fi
        if (( EDGE_ENABLED == 1 )); then
            systemctl disable "$EDGE_UNIT" >/dev/null 2>&1 || true
        fi
        if (( EDGE_STARTED == 1 )); then
            systemctl stop "$EDGE_UNIT" >/dev/null 2>&1 || true
        fi
        if (( UFW443_ADDED == 1 )); then
            ufw --force delete allow 443/tcp >/dev/null 2>&1 || true
        fi
        if (( UFW80_ADDED == 1 )); then
            ufw --force delete allow 80/tcp >/dev/null 2>&1 || true
        fi

        if (( ENV_CHANGED == 1 )) && [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
            install -o "$(stat -c '%u' "$ENV_BACKUP")" \
                -g "$(stat -c '%g' "$ENV_BACKUP")" \
                -m "$(stat -c '%a' "$ENV_BACKUP")" \
                "$ENV_BACKUP" "$API_ENV" || true
            systemctl restart "$API_UNIT" >/dev/null 2>&1 || true
        fi

        log 'Created files and the dedicated account are retained for audit; protected IGST components were not changed.' >&2
    fi

    if [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
        rm -f -- "$ENV_BACKUP"
    fi

    exit "$rc"
}

trap on_exit EXIT
trap 'exit 130' HUP INT TERM

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "required command is unavailable: $1"
}

sha256_of() {
    sha256sum -- "$1" | awk '{print $1}'
}

require_sha256() {
    local path=$1
    local expected=$2
    local actual

    [[ -f "$path" ]] || die "required protected file is missing: $path"
    actual="$(sha256_of "$path")"
    [[ "$actual" == "$expected" ]] || die "SHA-256 mismatch for $path (expected $expected, got $actual)"
}

require_unit_absent() {
    local unit=$1
    local state

    state="$(systemctl show --property=LoadState --value "$unit" 2>/dev/null || true)"
    [[ "$state" == 'not-found' ]] || die "systemd unit collision: $unit has LoadState=$state"
}

require_stat() {
    local path=$1
    local kind=$2
    local expected_owner=$3
    local expected_group=$4
    local expected_mode=$5
    local actual

    case "$kind" in
        directory)
            [[ -d "$path" && ! -L "$path" ]] || die "expected a non-symlink directory: $path"
            ;;
        file)
            [[ -f "$path" && ! -L "$path" ]] || die "expected a non-symlink regular file: $path"
            ;;
        *)
            die "internal error: unsupported stat kind $kind"
            ;;
    esac

    actual="$(stat -c '%U:%G:%a' "$path")"
    [[ "$actual" == "$expected_owner:$expected_group:$expected_mode" ]] \
        || die "unexpected owner/group/mode for $path (expected $expected_owner:$expected_group:$expected_mode, got $actual)"
}

require_empty_directory() {
    local path=$1
    local unexpected

    unexpected="$(find "$path" -mindepth 1 -print -quit)"
    [[ -z "$unexpected" ]] || die "expected an empty directory but found $unexpected"
}

require_exact_children() {
    local path=$1
    local expected=$2
    local actual

    actual="$(find "$path" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)"
    [[ "$actual" == "$expected" ]] || die "unexpected entries under $path (found: ${actual//$'\n'/, })"
}

verify_resume_acme_webroot() {
    local well_known="$ACME_WEBROOT/.well-known"
    local challenge_dir="$ACME_WEBROOT/.well-known/acme-challenge"
    local entry
    local base
    local count=0
    local challenge_stat

    VERIFIED_ACME_RESIDUE=''
    ACME_DIR_MIGRATION_NEEDED=0
    if [[ -z "$(find "$ACME_WEBROOT" -mindepth 1 -print -quit)" ]]; then
        return 0
    fi

    require_exact_children "$ACME_WEBROOT" '.well-known'
    # install -d creates the intermediate .well-known component with its
    # standard root-owned 0755 mode, then applies the requested mode/group to
    # the final acme-challenge directory.
    require_stat "$well_known" directory root root 755
    require_exact_children "$well_known" 'acme-challenge'
    [[ -d "$challenge_dir" && ! -L "$challenge_dir" ]] \
        || die "expected a non-symlink directory: $challenge_dir"
    challenge_stat="$(stat -c '%U:%G:%a' "$challenge_dir")"
    if [[ "$challenge_stat" == "root:$WEB_GROUP:2750" ]]; then
        ACME_DIR_MIGRATION_NEEDED=0
    elif [[ "$challenge_stat" == "root:$WEB_GROUP:750" ]]; then
        ACME_DIR_MIGRATION_NEEDED=1
    else
        die "unexpected challenge-directory ownership or mode: $challenge_stat"
    fi

    while IFS= read -r entry; do
        [[ -n "$entry" ]] || continue
        base="${entry##*/}"
        [[ "$base" =~ ^installer-preflight-[0-9]+$ ]] \
            || die "unexpected ACME webroot residue: $entry"
        require_stat "$entry" file root "$WEB_GROUP" 640
        [[ "$(<"$entry")" == "$base" ]] || die "unexpected content in retained challenge file: $entry"
        if [[ -n "$VERIFIED_ACME_RESIDUE" ]]; then
            VERIFIED_ACME_RESIDUE+=$'\n'
        fi
        VERIFIED_ACME_RESIDUE+="$entry"
        count=$((count + 1))
        (( count <= 5 )) || die 'too many retained installer challenge files'
    done < <(find "$challenge_dir" -mindepth 1 -maxdepth 1 -print | sort)

    if (( ACME_DIR_MIGRATION_NEEDED == 1 && count != 0 )); then
        die 'legacy 0750 challenge directory is accepted only when empty'
    fi

    if (( ACME_DIR_MIGRATION_NEEDED == 1 )); then
        log 'Retained empty challenge directory exactly matches the known pre-setgid 0750 mode'
    elif (( count == 0 )); then
        log 'Retained ACME webroot contains only the expected empty challenge-directory structure'
    else
        log "Verified $count narrowly scoped retained installer challenge file(s)"
    fi
}

verify_staging_retry_state() {
    local accounts="$LEGO_STAGING_STATE/accounts"
    local server_dir="$LEGO_STAGING_STATE/accounts/acme-staging-v02.api.letsencrypt.org"
    local account_dir="$LEGO_STAGING_STATE/accounts/acme-staging-v02.api.letsencrypt.org/noemail@example.com"
    local account_json="$LEGO_STAGING_STATE/accounts/acme-staging-v02.api.letsencrypt.org/noemail@example.com/account.json"
    local account_key="$LEGO_STAGING_STATE/accounts/acme-staging-v02.api.letsencrypt.org/noemail@example.com/noemail@example.com.key"

    if [[ -z "$(find "$LEGO_STAGING_STATE" -mindepth 1 -print -quit)" ]]; then
        return 0
    fi

    require_exact_children "$LEGO_STAGING_STATE" 'accounts'
    require_stat "$accounts" directory root root 700
    require_exact_children "$accounts" 'acme-staging-v02.api.letsencrypt.org'
    require_stat "$server_dir" directory root root 700
    require_exact_children "$server_dir" 'noemail@example.com'
    require_stat "$account_dir" directory root root 700
    require_exact_children "$account_dir" $'account.json\nnoemail@example.com.key'
    require_stat "$account_json" file root root 600
    require_stat "$account_key" file root root 600
    [[ "$(stat -c '%s' "$account_json")" == '285' ]] \
        || die 'retained staging account.json does not have the exact expected size'
    [[ "$(stat -c '%s' "$account_key")" == '241' ]] \
        || die 'retained staging account private key does not have the exact expected size'
    openssl pkey -in "$account_key" -noout -check >/dev/null \
        || die 'retained staging account private key failed OpenSSL validation'

    log 'Retained lego staging state is exactly the validated account-only retry state; no certificate files exist'
}

wait_for_api_health() {
    local attempt
    local body

    for attempt in {1..20}; do
        body="$(curl --fail --silent --show-error --max-time 3 \
            'http://127.0.0.1:3210/api/health' 2>/dev/null || true)"
        if [[ "$body" == '{"ok":true,"database":"ok"}' ]]; then
            return 0
        fi
        sleep 1
    done

    die "$API_UNIT did not return the expected database-backed health response"
}

wait_for_edge_bootstrap() {
    local attempt
    local listener
    local api_code

    for attempt in {1..20}; do
        if systemctl is-active --quiet "$EDGE_UNIT"; then
            listener="$(ss -H -lntup | awk '$1 == "tcp" && $5 == "0.0.0.0:80" { print $5; exit }')"
            if [[ "$listener" == '0.0.0.0:80' ]]; then
                api_code="$(curl --noproxy '*' --silent --output /dev/null \
                    --write-out '%{http_code}' --max-time 2 \
                    -H "Host: $DOMAIN" 'http://127.0.0.1/api/health' 2>/dev/null || true)"
                if [[ "$api_code" == '403' ]]; then
                    return 0
                fi
            fi
        fi
        sleep 1
    done

    die "$EDGE_UNIT did not become active, bind port 80, and serve its bootstrap policy within 20 seconds"
}

run_replica_check() {
    local output
    local lag

    if ! output="$("$REPLICA_CHECK" 2>&1)"; then
        printf '%s\n' "$output" >&2
        die "$REPLICA_CHECK failed"
    fi
    printf '%s\n' "$output"

    if [[ "$output" =~ ^Replica\ healthy\;\ lag=([0-9]+)s\; ]]; then
        lag="${BASH_REMATCH[1]}"
    else
        die "unexpected replica-check result; expected 'Replica healthy; lag=Ns;'"
    fi

    (( lag <= MAX_REPLICA_LAG_SECONDS )) || die "replication lag is ${lag}s; maximum allowed is ${MAX_REPLICA_LAG_SECONDS}s"
}

snapshot_required_state() {
    log 'Required resource snapshot:'
    free -m
    df -h
    ss -lntup
    systemctl is-active "$MYSQL_UNIT"
    run_replica_check
}

preflight_release() {
    local special_entry
    local forbidden_web_file
    local lego_hash
    local required

    case "$RELEASE_ROOT/" in
        /opt/igstprem/*|/var/lib/mysql/*|/var/backups/igst-restic/*|/etc/igst-secrets/*)
            die "release root is inside a protected path: $RELEASE_ROOT"
            ;;
    esac

    [[ -d "$WEB_SOURCE" && ! -L "$WEB_SOURCE" ]] || die "missing regular web/ directory at $WEB_SOURCE"
    [[ -d "$DEPLOY_SOURCE" && ! -L "$DEPLOY_SOURCE" ]] || die "missing regular deploy/ directory at $DEPLOY_SOURCE"
    [[ -f "$LEGO_SOURCE" && ! -L "$LEGO_SOURCE" ]] || die "missing regular lego binary at $LEGO_SOURCE"

    for required in \
        "$WEB_SOURCE/index.html" \
        "$WEB_SOURCE/robots.txt" \
        "$WEB_SOURCE/data/roadGraph.json" \
        "$DEPLOY_SOURCE/jobfinder-nginx.conf" \
        "$DEPLOY_SOURCE/jobfinder-site-bootstrap.conf" \
        "$DEPLOY_SOURCE/jobfinder-site-https.conf" \
        "$DEPLOY_SOURCE/jobfinder-nginx.service" \
        "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" \
        "$DEPLOY_SOURCE/jobfinder-cert-renew.service" \
        "$DEPLOY_SOURCE/jobfinder-cert-renew.timer"; do
        [[ -f "$required" && ! -L "$required" ]] || die "missing regular release artifact: $required"
    done

    special_entry="$(find "$WEB_SOURCE" -mindepth 1 ! -type d ! -type f -print -quit)"
    [[ -z "$special_entry" ]] || die "web release contains a symlink or special entry: $special_entry"
    [[ -n "$(find "$WEB_SOURCE" -type f -print -quit)" ]] || die 'web release contains no files'

    forbidden_web_file="$(find "$WEB_SOURCE" -type f \( \
        -name '*.map' -o -name '*.env' -o -name '*.pem' -o -name '*.key' -o \
        -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \
        \) -print -quit)"
    [[ -z "$forbidden_web_file" ]] || die "web release contains a forbidden private artifact: $forbidden_web_file"
    [[ -z "$(find "$WEB_SOURCE" -type d -name '.git' -print -quit)" ]] || die 'web release contains a .git directory'

    lego_hash="$(sha256_of "$LEGO_SOURCE")"
    [[ "$lego_hash" == "$EXPECTED_LEGO_SHA256" ]] || die "lego SHA-256 mismatch (expected $EXPECTED_LEGO_SHA256, got $lego_hash)"

    grep -Fqx 'MemoryMax=16M' "$DEPLOY_SOURCE/jobfinder-nginx.service" || die 'edge service must retain MemoryMax=16M'
    grep -Fqx 'SupplementaryGroups=jobfinder-web' "$DEPLOY_SOURCE/jobfinder-nginx.service" \
        || die 'edge service must use only the dedicated web group for state-directory access'
    grep -Fqx 'InaccessiblePaths=/opt/jobfinder' "$DEPLOY_SOURCE/jobfinder-nginx.service" \
        || die 'edge service must not have filesystem access to the existing API tree'
    grep -Fqx 'InaccessiblePaths=/opt/igstprem /var/lib/mysql /var/backups/igst-restic /etc/igst-secrets' \
        "$DEPLOY_SOURCE/jobfinder-nginx.service" || die 'edge service is missing the required protected-path isolation'
    grep -Fqx 'InaccessiblePaths=/opt/jobfinder' "$DEPLOY_SOURCE/jobfinder-cert-renew.service" \
        || die 'renewal service must not have filesystem access to the existing API tree'
    grep -Fqx 'InaccessiblePaths=/opt/igstprem /var/lib/mysql /var/backups/igst-restic /etc/igst-secrets' \
        "$DEPLOY_SOURCE/jobfinder-cert-renew.service" || die 'renewal service is missing the required protected-path isolation'
    grep -Fqx '    root /opt/jobfinder-public/web;' "$DEPLOY_SOURCE/jobfinder-site-https.conf" \
        || die 'HTTPS site does not use the separate public static root'
    grep -Fqx "lego='/opt/jobfinder-public/bin/lego'" "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" \
        || die 'renewal script does not use the separate public binary root'
    grep -Fqx '    umask 0027' "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" \
        || die 'renewal script does not scope lego token permissions to umask 0027'
    grep -Fqx "challenge_dir='/var/lib/jobfinder-nginx/acme/.well-known/acme-challenge'" \
        "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" || die 'renewal script does not verify the setgid challenge directory'
}

verify_resume_install_state() {
    local passwd_record
    local group_record
    local account_name
    local account_uid
    local account_gid
    local account_home
    local account_shell
    local group_name
    local group_gid
    local group_members
    local bad_entry
    local edge_active
    local edge_enabled
    local renew_active
    local timer_active
    local timer_enabled
    local legacy_condition_count

    log 'Verifying every retained JobFinder public-install artifact before resume'

    passwd_record="$(getent passwd "$WEB_USER")" || die "retained user is missing: $WEB_USER"
    group_record="$(getent group "$WEB_GROUP")" || die "retained group is missing: $WEB_GROUP"
    IFS=: read -r account_name _ account_uid account_gid _ account_home account_shell <<<"$passwd_record"
    IFS=: read -r group_name _ group_gid group_members <<<"$group_record"

    [[ "$account_name" == "$WEB_USER" && "$group_name" == "$WEB_GROUP" ]] || die 'retained web account names are incorrect'
    [[ "$account_gid" == "$group_gid" ]] || die "$WEB_USER does not use $WEB_GROUP as its primary group"
    [[ "$account_uid" =~ ^[0-9]+$ && "$account_uid" -lt 1000 ]] || die "$WEB_USER is not a system account"
    [[ "$account_home" == '/nonexistent' ]] || die "$WEB_USER has an unexpected home directory: $account_home"
    [[ "$account_shell" == '/usr/sbin/nologin' ]] || die "$WEB_USER has an unexpected shell: $account_shell"
    [[ -z "$group_members" ]] || die "$WEB_GROUP has unexpected explicit members: $group_members"
    [[ "$(id -Gn "$WEB_USER")" == "$WEB_GROUP" ]] || die "$WEB_USER has unexpected supplementary groups"

    require_stat "$PUBLIC_ROOT" directory root "$WEB_GROUP" 750
    require_exact_children "$PUBLIC_ROOT" $'bin\nweb'
    require_stat "$WEB_ROOT" directory root "$WEB_GROUP" 750
    require_stat "$BIN_ROOT" directory root root 750

    bad_entry="$(find "$WEB_ROOT" -mindepth 1 ! -type d ! -type f -print -quit)"
    [[ -z "$bad_entry" ]] || die "retained web tree contains a symlink or special entry: $bad_entry"
    bad_entry="$(find "$WEB_ROOT" -type d \( ! -user root -o ! -group "$WEB_GROUP" -o ! -perm 0750 \) -print -quit)"
    [[ -z "$bad_entry" ]] || die "retained web directory has unexpected ownership or mode: $bad_entry"
    bad_entry="$(find "$WEB_ROOT" -type f \( ! -user root -o ! -group "$WEB_GROUP" -o ! -perm 0640 \) -print -quit)"
    [[ -z "$bad_entry" ]] || die "retained web file has unexpected ownership or mode: $bad_entry"
    diff --brief --recursive --no-dereference "$WEB_SOURCE" "$WEB_ROOT" >/dev/null \
        || die 'retained web tree does not exactly match the release content'

    require_stat "$INSTALLED_LEGO" file root root 755
    require_stat "$INSTALLED_RENEW_SCRIPT" file root root 750
    [[ "$(sha256_of "$INSTALLED_LEGO")" == "$EXPECTED_LEGO_SHA256" ]] || die 'retained lego binary checksum is incorrect'
    if cmp -s "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" "$INSTALLED_RENEW_SCRIPT"; then
        RENEW_SCRIPT_UPDATE_NEEDED=0
    elif [[ "$(sha256_of "$INSTALLED_RENEW_SCRIPT")" == "$EXPECTED_LEGACY_RENEW_SCRIPT_SHA256" ]]; then
        RENEW_SCRIPT_UPDATE_NEEDED=1
        log 'Retained renewal script exactly matches the known pre-setgid-token release'
    else
        die 'retained renewal script differs unexpectedly from the release'
    fi

    require_stat "$EDGE_CONFIG_ROOT" directory root "$WEB_GROUP" 750
    require_exact_children "$EDGE_CONFIG_ROOT" $'nginx.conf\nsite.conf\ntls'
    require_stat "$EDGE_CONFIG" file root "$WEB_GROUP" 640
    require_stat "$EDGE_SITE" file root "$WEB_GROUP" 640
    cmp -s "$DEPLOY_SOURCE/jobfinder-nginx.conf" "$EDGE_CONFIG" || die 'retained edge configuration differs from the release'
    cmp -s "$DEPLOY_SOURCE/jobfinder-site-bootstrap.conf" "$EDGE_SITE" || die 'retained site is not the verified bootstrap configuration'
    require_stat "$TLS_ROOT" directory root root 700
    require_exact_children "$TLS_ROOT" 'releases'
    require_stat "$TLS_ROOT/releases" directory root root 700
    require_empty_directory "$TLS_ROOT/releases"

    [[ -d "$EDGE_STATE" && ! -L "$EDGE_STATE" ]] || die "expected a non-symlink directory: $EDGE_STATE"
    [[ -d "$EDGE_STATE/client_temp" && ! -L "$EDGE_STATE/client_temp" ]] \
        || die "expected a non-symlink directory: $EDGE_STATE/client_temp"
    [[ -d "$EDGE_STATE/proxy_temp" && ! -L "$EDGE_STATE/proxy_temp" ]] \
        || die "expected a non-symlink directory: $EDGE_STATE/proxy_temp"
    if [[ "$(stat -c '%U:%G:%a' "$EDGE_STATE")" == "root:$WEB_GROUP:750" \
        && "$(stat -c '%U:%G:%a' "$EDGE_STATE/client_temp")" == "root:$WEB_GROUP:770" \
        && "$(stat -c '%U:%G:%a' "$EDGE_STATE/proxy_temp")" == "root:$WEB_GROUP:770" ]]; then
        EDGE_STATE_MIGRATION_NEEDED=0
    elif [[ "$(stat -c '%U:%G:%a' "$EDGE_STATE")" == "root:$WEB_GROUP:750" \
        && "$(stat -c '%U:%G:%a' "$EDGE_STATE/client_temp")" == "$WEB_USER:$WEB_GROUP:770" \
        && "$(stat -c '%U:%G:%a' "$EDGE_STATE/proxy_temp")" == "$WEB_USER:$WEB_GROUP:770" ]]; then
        EDGE_STATE_MIGRATION_NEEDED=0
        log 'Retained Nginx temp directories exactly match the expected post-Nginx ownership and modes'
    elif [[ "$(stat -c '%U:%G:%a' "$EDGE_STATE")" == "$WEB_USER:$WEB_GROUP:750" \
        && "$(stat -c '%U:%G:%a' "$EDGE_STATE/client_temp")" == "$WEB_USER:$WEB_GROUP:700" \
        && "$(stat -c '%U:%G:%a' "$EDGE_STATE/proxy_temp")" == "$WEB_USER:$WEB_GROUP:700" ]]; then
        EDGE_STATE_MIGRATION_NEEDED=1
        log 'Retained Nginx state directories exactly match the known pre-fix ownership and modes'
    else
        die 'retained Nginx state-directory ownership or modes are unexpected'
    fi
    require_exact_children "$EDGE_STATE" $'acme\nclient_temp\nproxy_temp'
    require_stat "$ACME_WEBROOT" directory root "$WEB_GROUP" 750
    require_empty_directory "$EDGE_STATE/client_temp"
    require_empty_directory "$EDGE_STATE/proxy_temp"
    verify_resume_acme_webroot

    require_stat "$LEGO_STATE" directory root root 700
    require_exact_children "$LEGO_STATE" 'staging'
    require_stat "$LEGO_STAGING_STATE" directory root root 700
    verify_staging_retry_state

    if [[ -e /run/jobfinder-nginx || -L /run/jobfinder-nginx ]]; then
        require_stat /run/jobfinder-nginx directory root root 755
        require_empty_directory /run/jobfinder-nginx
    fi

    require_stat "/etc/systemd/system/$EDGE_UNIT" file root root 644
    require_stat "/etc/systemd/system/$RENEW_UNIT" file root root 644
    require_stat "/etc/systemd/system/$RENEW_TIMER" file root root 644
    if cmp -s "$DEPLOY_SOURCE/jobfinder-nginx.service" "/etc/systemd/system/$EDGE_UNIT"; then
        EDGE_UNIT_UPDATE_NEEDED=0
    else
        [[ "$(grep -c '^SupplementaryGroups=' "/etc/systemd/system/$EDGE_UNIT" || true)" == '0' ]] \
            || die 'retained edge unit has an unexpected supplementary-group directive'
        cmp -s \
            <(sed '/^Type=simple$/a SupplementaryGroups=jobfinder-web' "/etc/systemd/system/$EDGE_UNIT") \
            "$DEPLOY_SOURCE/jobfinder-nginx.service" \
            || die 'retained edge unit has changes beyond the one missing supplementary-group line'
        EDGE_UNIT_UPDATE_NEEDED=1
        log 'Retained edge unit exactly matches the known form missing SupplementaryGroups=jobfinder-web'
    fi
    cmp -s "$DEPLOY_SOURCE/jobfinder-cert-renew.timer" "/etc/systemd/system/$RENEW_TIMER" \
        || die 'retained renewal timer differs from the release'

    if cmp -s "$DEPLOY_SOURCE/jobfinder-cert-renew.service" "/etc/systemd/system/$RENEW_UNIT"; then
        RENEW_UNIT_UPDATE_NEEDED=0
    else
        legacy_condition_count="$(grep -c '^ConditionPathIsExecutable=/opt/jobfinder-public/bin/' "/etc/systemd/system/$RENEW_UNIT" || true)"
        [[ "$legacy_condition_count" == '2' ]] || die 'retained renewal unit differs unexpectedly from the release'
        cmp -s \
            <(sed 's|^ConditionPathIsExecutable=/opt/jobfinder-public/bin/|ConditionPathExists=/opt/jobfinder-public/bin/|' "/etc/systemd/system/$RENEW_UNIT") \
            "$DEPLOY_SOURCE/jobfinder-cert-renew.service" \
            || die 'retained renewal unit has changes beyond the two known unsupported condition directives'
        RENEW_UNIT_UPDATE_NEEDED=1
        log 'Retained renewal unit exactly matches the known legacy condition-directive form'
    fi

    edge_active="$(systemctl is-active "$EDGE_UNIT" 2>/dev/null || true)"
    edge_enabled="$(systemctl is-enabled "$EDGE_UNIT" 2>/dev/null || true)"
    renew_active="$(systemctl is-active "$RENEW_UNIT" 2>/dev/null || true)"
    timer_active="$(systemctl is-active "$RENEW_TIMER" 2>/dev/null || true)"
    timer_enabled="$(systemctl is-enabled "$RENEW_TIMER" 2>/dev/null || true)"
    if [[ "$edge_active" == 'inactive' ]]; then
        EDGE_RESET_FAILED_NEEDED=0
    elif [[ "$edge_active" == 'failed' ]]; then
        EDGE_RESET_FAILED_NEEDED=1
        log "$EDGE_UNIT is in the expected failed state and will be reset only after all preflight gates pass"
    else
        die "$EDGE_UNIT must be inactive or failed before resume (got $edge_active)"
    fi
    [[ "$edge_enabled" == 'disabled' ]] || die "$EDGE_UNIT must be disabled before resume (got $edge_enabled)"
    [[ "$renew_active" == 'inactive' ]] || die "$RENEW_UNIT must be inactive before resume (got $renew_active)"
    [[ "$timer_active" == 'inactive' ]] || die "$RENEW_TIMER must be inactive before resume (got $timer_active)"
    [[ "$timer_enabled" == 'disabled' ]] || die "$RENEW_TIMER must be disabled before resume (got $timer_enabled)"

    log 'Retained installation is exact and safe to resume'
}

preflight_server() {
    local mode=${1:-fresh}
    local global_active
    local global_enabled
    local replica_listener
    local conflicting_ports
    local resolved_ipv4
    local api_health
    local api_memory_bytes
    local estimated_mib
    local free_bytes
    local collision

    [[ "$EUID" -eq 0 ]] || die 'run this installer as root'

    case "$mode" in
        fresh)
            for collision in \
                "$PUBLIC_ROOT" \
                "$EDGE_CONFIG_ROOT" \
                "$EDGE_STATE" \
                "$LEGO_STATE" \
                '/run/jobfinder-nginx' \
                "/etc/systemd/system/$EDGE_UNIT" \
                "/etc/systemd/system/$RENEW_UNIT" \
                "/etc/systemd/system/$RENEW_TIMER"; do
                [[ ! -e "$collision" && ! -L "$collision" ]] || die "new-project path collision: $collision"
            done

            getent passwd "$WEB_USER" >/dev/null 2>&1 && die "user collision: $WEB_USER"
            getent group "$WEB_GROUP" >/dev/null 2>&1 && die "group collision: $WEB_GROUP"
            require_unit_absent "$EDGE_UNIT"
            require_unit_absent "$RENEW_UNIT"
            require_unit_absent "$RENEW_TIMER"
            ;;
        resume)
            verify_resume_install_state
            ;;
        *)
            die "internal error: unsupported preflight mode $mode"
            ;;
    esac

    [[ -d "$API_ROOT" && ! -L "$API_ROOT" ]] || die "existing API root is missing or unsafe: $API_ROOT"
    [[ -f "$API_ENV" && ! -L "$API_ENV" ]] || die "existing API environment file is missing or unsafe: $API_ENV"

    global_active="$(systemctl is-active "$GLOBAL_NGINX_UNIT" 2>/dev/null || true)"
    global_enabled="$(systemctl is-enabled "$GLOBAL_NGINX_UNIT" 2>/dev/null || true)"
    [[ "$global_active" == 'inactive' ]] || die "$GLOBAL_NGINX_UNIT must be exactly inactive (got $global_active)"
    [[ "$global_enabled" == 'disabled' ]] || die "$GLOBAL_NGINX_UNIT must be exactly disabled (got $global_enabled)"

    systemctl is-active --quiet "$MYSQL_UNIT" || die "$MYSQL_UNIT is not active"
    systemctl is-active --quiet "$API_UNIT" || die "$API_UNIT is not active"
    run_replica_check

    require_sha256 "$PROTECTED_IGST_SERVICE" "$EXPECTED_IGST_SERVICE_SHA256"
    require_sha256 "$PROTECTED_IGST_SITE_AVAILABLE" "$EXPECTED_IGST_NGINX_SHA256"
    require_sha256 "$PROTECTED_IGST_SITE_ENABLED" "$EXPECTED_IGST_NGINX_SHA256"

    conflicting_ports="$(ss -H -lntup | awk '$5 ~ /:(80|443)$/ { print }')"
    [[ -z "$conflicting_ports" ]] || {
        printf '%s\n' "$conflicting_ports" >&2
        die 'ports 80 and/or 443 are already in use'
    }

    replica_listener="$(ss -H -lntup | awk -v port=":$API_PORT" '$1 == "tcp" && $5 ~ (port "$") { print }')"
    [[ -n "$replica_listener" ]] || die "nothing is listening on 127.0.0.1:$API_PORT"
    if awk -v endpoint="127.0.0.1:$API_PORT" '$5 != endpoint { exit 1 }' <<<"$replica_listener"; then
        :
    else
        printf '%s\n' "$replica_listener" >&2
        die "$API_PORT is not exclusively bound to 127.0.0.1"
    fi

    api_health="$(curl --fail --silent --show-error --max-time 5 \
        "http://127.0.0.1:$API_PORT/api/health")"
    [[ "$api_health" == '{"ok":true,"database":"ok"}' ]] || die 'unexpected JobFinder API health response'

    resolved_ipv4="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u)"
    [[ "$resolved_ipv4" == "$PUBLIC_IP" ]] || die "$DOMAIN must resolve only to $PUBLIC_IP (got: ${resolved_ipv4:-none})"

    api_memory_bytes="$(systemctl show --property=MemoryCurrent --value "$API_UNIT")"
    [[ "$api_memory_bytes" =~ ^[0-9]+$ ]] || die "could not read $API_UNIT MemoryCurrent"
    estimated_mib=$(( (api_memory_bytes + (EDGE_MEMORY_CAP_MIB * 1024 * 1024) + 1048575) / 1048576 ))
    (( estimated_mib < STEADY_MEMORY_LIMIT_MIB )) || die "estimated steady JobFinder memory is ${estimated_mib} MiB, not below ${STEADY_MEMORY_LIMIT_MIB} MiB"
    log "Estimated steady JobFinder memory: ${estimated_mib} MiB (live API plus ${EDGE_MEMORY_CAP_MIB} MiB edge cap)"

    free_bytes="$(df --output=avail -B1 /opt | awk 'NR==2 {gsub(/ /, "", $0); print $0}')"
    [[ "$free_bytes" =~ ^[0-9]+$ ]] || die 'could not determine free disk space for /opt'
    (( free_bytes >= 209715200 )) || die 'less than 200 MiB is free under /opt'

    ufw status | grep -Fqx 'Status: active' || die 'UFW must already be active'
    if ufw status numbered | grep -Eiq '^\[[[:space:]]*[0-9]+\][[:space:]]+(80|443)(/tcp)?([[:space:]]|$)'; then
        die 'UFW already contains a rule mentioning port 80 or 443'
    fi
}

install_files() {
    log 'Creating the dedicated unprivileged web account and isolated paths'
    groupadd --system "$WEB_GROUP"
    useradd --system --gid "$WEB_GROUP" --home-dir /nonexistent \
        --shell /usr/sbin/nologin --no-create-home "$WEB_USER"

    install -d -o root -g "$WEB_GROUP" -m 0750 "$PUBLIC_ROOT" "$WEB_ROOT"
    cp -a -- "$WEB_SOURCE"/. "$WEB_ROOT"/
    chown -R root:"$WEB_GROUP" "$WEB_ROOT"
    find "$WEB_ROOT" -type d -exec chmod 0750 {} +
    find "$WEB_ROOT" -type f -exec chmod 0640 {} +

    install -d -o root -g root -m 0750 "$BIN_ROOT"
    install -o root -g root -m 0755 "$LEGO_SOURCE" "$INSTALLED_LEGO"
    install -o root -g root -m 0750 \
        "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" "$INSTALLED_RENEW_SCRIPT"

    install -d -o root -g "$WEB_GROUP" -m 0750 "$EDGE_CONFIG_ROOT"
    install -d -o root -g root -m 0700 "$TLS_ROOT" "$TLS_ROOT/releases"
    install -o root -g "$WEB_GROUP" -m 0640 \
        "$DEPLOY_SOURCE/jobfinder-nginx.conf" "$EDGE_CONFIG"
    install -o root -g "$WEB_GROUP" -m 0640 \
        "$DEPLOY_SOURCE/jobfinder-site-bootstrap.conf" "$EDGE_SITE"

    install -d -o root -g "$WEB_GROUP" -m 0750 "$EDGE_STATE"
    install -d -o root -g "$WEB_GROUP" -m 0770 \
        "$EDGE_STATE/client_temp" "$EDGE_STATE/proxy_temp"
    install -d -o root -g "$WEB_GROUP" -m 0750 "$ACME_WEBROOT"
    install -d -o root -g root -m 0700 "$LEGO_STATE" "$LEGO_STAGING_STATE"

    require_stat "$EDGE_STATE" directory root "$WEB_GROUP" 750
    require_stat "$EDGE_STATE/client_temp" directory root "$WEB_GROUP" 770
    require_stat "$EDGE_STATE/proxy_temp" directory root "$WEB_GROUP" 770

    install -o root -g root -m 0644 \
        "$DEPLOY_SOURCE/jobfinder-nginx.service" "/etc/systemd/system/$EDGE_UNIT"
    install -o root -g root -m 0644 \
        "$DEPLOY_SOURCE/jobfinder-cert-renew.service" "/etc/systemd/system/$RENEW_UNIT"
    install -o root -g root -m 0644 \
        "$DEPLOY_SOURCE/jobfinder-cert-renew.timer" "/etc/systemd/system/$RENEW_TIMER"

    [[ "$(sha256_of "$INSTALLED_LEGO")" == "$EXPECTED_LEGO_SHA256" ]] || die 'installed lego binary failed checksum verification'
    cmp -s "$DEPLOY_SOURCE/jobfinder-nginx.conf" "$EDGE_CONFIG" || die 'installed edge configuration differs from release'
    cmp -s "$DEPLOY_SOURCE/jobfinder-site-bootstrap.conf" "$EDGE_SITE" || die 'installed bootstrap site differs from release'

    runuser -u "$WEB_USER" -- test -r "$WEB_ROOT/index.html" || die "$WEB_USER cannot read the deployed index"
}

validate_units_and_bootstrap() {
    log 'Validating only the new JobFinder units and isolated Nginx configuration'

    if (( RENEW_SCRIPT_UPDATE_NEEDED == 1 )); then
        log 'Updating only the verified legacy renewal script with scoped token permissions'
        install -o root -g root -m 0750 \
            "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" "$INSTALLED_RENEW_SCRIPT"
        cmp -s "$DEPLOY_SOURCE/renew-jobfinder-cert.sh" "$INSTALLED_RENEW_SCRIPT" \
            || die 'targeted renewal-script update did not match the release'
        RENEW_SCRIPT_UPDATE_NEEDED=0
    fi

    if (( EDGE_UNIT_UPDATE_NEEDED == 1 )); then
        log 'Adding only the verified missing jobfinder-web supplementary-group directive to the edge unit'
        install -o root -g root -m 0644 \
            "$DEPLOY_SOURCE/jobfinder-nginx.service" "/etc/systemd/system/$EDGE_UNIT"
        cmp -s "$DEPLOY_SOURCE/jobfinder-nginx.service" "/etc/systemd/system/$EDGE_UNIT" \
            || die 'targeted edge-unit supplementary-group update did not match the release'
        EDGE_UNIT_UPDATE_NEEDED=0
    fi

    if (( RENEW_UNIT_UPDATE_NEEDED == 1 )); then
        log 'Replacing only the two verified unsupported renewal-unit conditions with ConditionPathExists'
        install -o root -g root -m 0644 \
            "$DEPLOY_SOURCE/jobfinder-cert-renew.service" "/etc/systemd/system/$RENEW_UNIT"
        cmp -s "$DEPLOY_SOURCE/jobfinder-cert-renew.service" "/etc/systemd/system/$RENEW_UNIT" \
            || die 'targeted renewal-unit condition update did not match the release'
        RENEW_UNIT_UPDATE_NEEDED=0
    fi

    if (( EDGE_STATE_MIGRATION_NEEDED == 1 )); then
        log 'Applying the narrowly verified Nginx state-directory access fix'
        chown root:"$WEB_GROUP" "$EDGE_STATE" "$EDGE_STATE/client_temp" "$EDGE_STATE/proxy_temp"
        chmod 0750 "$EDGE_STATE"
        chmod 0770 "$EDGE_STATE/client_temp" "$EDGE_STATE/proxy_temp"
        require_stat "$EDGE_STATE" directory root "$WEB_GROUP" 750
        require_stat "$EDGE_STATE/client_temp" directory root "$WEB_GROUP" 770
        require_stat "$EDGE_STATE/proxy_temp" directory root "$WEB_GROUP" 770
        EDGE_STATE_MIGRATION_NEEDED=0
    fi

    if (( EDGE_RESET_FAILED_NEEDED == 1 )); then
        log "Resetting only the verified failed state of $EDGE_UNIT"
        systemctl reset-failed "$EDGE_UNIT"
        [[ "$(systemctl is-active "$EDGE_UNIT" 2>/dev/null || true)" == 'inactive' ]] \
            || die "$EDGE_UNIT did not return to inactive after reset-failed"
        EDGE_RESET_FAILED_NEEDED=0
    fi

    local challenge_dir="$ACME_WEBROOT/.well-known/acme-challenge"
    if (( ACME_DIR_MIGRATION_NEEDED == 1 )); then
        log 'Adding setgid only to the verified empty legacy challenge directory'
        chmod 2750 "$challenge_dir"
        ACME_DIR_MIGRATION_NEEDED=0
    elif [[ ! -e "$challenge_dir" && ! -L "$challenge_dir" ]]; then
        install -d -o root -g "$WEB_GROUP" -m 2750 "$challenge_dir"
    fi
    require_stat "$ACME_WEBROOT/.well-known" directory root root 755
    require_stat "$challenge_dir" directory root "$WEB_GROUP" 2750

    if [[ -n "$VERIFIED_ACME_RESIDUE" ]]; then
        log 'Removing only the previously verified installer challenge residue'
        while IFS= read -r residue; do
            [[ "$residue" == "$ACME_WEBROOT/.well-known/acme-challenge/installer-preflight-"* \
                && -f "$residue" && ! -L "$residue" ]] \
                || die "verified ACME residue changed before cleanup: $residue"
            rm -f -- "$residue"
        done <<<"$VERIFIED_ACME_RESIDUE"
        VERIFIED_ACME_RESIDUE=''
    fi

    if [[ ! -e /run/jobfinder-nginx && ! -L /run/jobfinder-nginx ]]; then
        install -d -o root -g root -m 0755 /run/jobfinder-nginx
    else
        require_stat /run/jobfinder-nginx directory root root 755
        require_empty_directory /run/jobfinder-nginx
    fi

    systemd-analyze verify \
        "/etc/systemd/system/$EDGE_UNIT" \
        "/etc/systemd/system/$RENEW_UNIT" \
        "/etc/systemd/system/$RENEW_TIMER"
    /usr/sbin/nginx -t -q -p "$EDGE_STATE/" -c "$EDGE_CONFIG"
    systemctl daemon-reload

    UFW80_ADDED=1
    ufw allow 80/tcp comment 'JobFinder HTTP-01 only'

    EDGE_STARTED=1
    systemctl start "$EDGE_UNIT"
    wait_for_edge_bootstrap

    local challenge_name="installer-preflight-$$"
    local challenge_path="$ACME_WEBROOT/.well-known/acme-challenge/$challenge_name"
    ACTIVE_CHALLENGE_FILE="$challenge_path"
    install -d -o root -g "$WEB_GROUP" -m 2750 "$(dirname "$challenge_path")"
    printf '%s\n' "$challenge_name" > "$challenge_path"
    chown root:"$WEB_GROUP" "$challenge_path"
    chmod 0640 "$challenge_path"
    [[ "$(curl --fail --silent --show-error --max-time 5 \
        -H "Host: $DOMAIN" "http://127.0.0.1/.well-known/acme-challenge/$challenge_name")" == "$challenge_name" ]] \
        || die 'isolated HTTP-01 location failed its local Host-header check'
    rm -f -- "$challenge_path"
    ACTIVE_CHALLENGE_FILE=''

    [[ "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 \
        -H "Host: $DOMAIN" 'http://127.0.0.1/api/health')" == '403' ]] \
        || die 'bootstrap listener exposed or mishandled the API'
}

run_lego() {
    local server=$1
    local state=$2
    local label=$3

    log "Requesting the $label certificate with the isolated HTTP-01 webroot"
    (
        # Scope the relaxed umask to lego. The setgid challenge directory
        # supplies jobfinder-web as the group, so HTTP-01 tokens become 0640.
        # The installer returns to its global 0077 umask on subshell exit.
        umask 0027
        "$INSTALLED_LEGO" run \
            --server "$server" \
            --path "$state" \
            --accept-tos \
            --domains "$DOMAIN" \
            --key-type EC256 \
            --http \
            --http.webroot "$ACME_WEBROOT" \
            --renew-days 21 \
            --no-random-sleep
    )
}

issue_certificates() {
    local staging_cert
    local cert_source
    local key_source
    local stamp
    local release_dir
    local cert_public
    local key_public

    log "Stopping only $API_UNIT while lego uses the available memory"
    API_PAUSED=1
    systemctl stop "$API_UNIT"
    ! systemctl is-active --quiet "$API_UNIT" || die "$API_UNIT did not stop for ACME issuance"

    run_lego 'https://acme-staging-v02.api.letsencrypt.org/directory' \
        "$LEGO_STAGING_STATE" 'Let us Encrypt staging'
    staging_cert="$LEGO_STAGING_STATE/certificates/$DOMAIN.crt"
    [[ -s "$staging_cert" ]] || die "staging issuance did not create $staging_cert"
    openssl x509 -in "$staging_cert" -noout -checkhost "$DOMAIN" >/dev/null

    run_lego 'https://acme-v02.api.letsencrypt.org/directory' \
        "$LEGO_STATE" 'Let us Encrypt production'

    cert_source="$LEGO_STATE/certificates/$DOMAIN.crt"
    key_source="$LEGO_STATE/certificates/$DOMAIN.key"
    [[ -s "$cert_source" ]] || die "production issuance did not create $cert_source"
    [[ -s "$key_source" ]] || die "production issuance did not create $key_source"
    openssl x509 -in "$cert_source" -noout -checkhost "$DOMAIN" >/dev/null
    openssl x509 -in "$cert_source" -noout -checkend 604800 >/dev/null
    openssl pkey -in "$key_source" -noout -check >/dev/null

    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    release_dir="$TLS_ROOT/releases/$stamp"
    [[ ! -e "$release_dir" ]] || die "TLS release collision: $release_dir"
    install -d -o root -g root -m 0700 "$release_dir"
    install -o root -g root -m 0644 "$cert_source" "$release_dir/fullchain.pem"
    install -o root -g root -m 0600 "$key_source" "$release_dir/privkey.pem"

    cert_public="$release_dir/cert-public.pem"
    key_public="$release_dir/key-public.pem"
    openssl x509 -in "$release_dir/fullchain.pem" -pubkey -noout > "$cert_public"
    openssl pkey -in "$release_dir/privkey.pem" -pubout > "$key_public"
    cmp -s "$cert_public" "$key_public" || die 'production certificate and private key do not match'
    rm -f -- "$cert_public" "$key_public"

    ln -s "$release_dir" "$TLS_ROOT/current"
    [[ -r "$TLS_ROOT/current/fullchain.pem" && -r "$TLS_ROOT/current/privkey.pem" ]] \
        || die 'TLS current link is incomplete'

    restore_api
    wait_for_api_health
}

activate_https() {
    log 'Installing the final HTTPS-only public site configuration'
    install -o root -g "$WEB_GROUP" -m 0640 \
        "$DEPLOY_SOURCE/jobfinder-site-https.conf" "$EDGE_SITE"
    cmp -s "$DEPLOY_SOURCE/jobfinder-site-https.conf" "$EDGE_SITE" || die 'installed HTTPS site differs from release'
    /usr/sbin/nginx -t -q -p "$EDGE_STATE/" -c "$EDGE_CONFIG"
    systemctl reload "$EDGE_UNIT"
    systemctl is-active --quiet "$EDGE_UNIT" || die "$EDGE_UNIT is inactive after its isolated reload"
}

set_api_origin() {
    local env_dir
    local env_tmp
    local env_uid
    local env_gid
    local env_mode

    log 'Setting the exact HTTPS application origin while preserving every other API environment value'
    env_dir="$(dirname "$API_ENV")"
    ENV_BACKUP="$(mktemp /run/jobfinder-env-backup.XXXXXX)"
    cp --preserve=mode,ownership,timestamps -- "$API_ENV" "$ENV_BACKUP"

    env_uid="$(stat -c '%u' "$API_ENV")"
    env_gid="$(stat -c '%g' "$API_ENV")"
    env_mode="$(stat -c '%a' "$API_ENV")"
    env_tmp="$(mktemp "$env_dir/.jobfinder.env.XXXXXX")"

    awk -v origin="JOBFINDER_APP_ORIGIN=https://$DOMAIN" '
        BEGIN { written = 0 }
        /^JOBFINDER_APP_ORIGIN=/ {
            if (!written) {
                print origin
                written = 1
            }
            next
        }
        { print }
        END {
            if (!written) print origin
        }
    ' "$API_ENV" > "$env_tmp"

    chown "$env_uid:$env_gid" "$env_tmp"
    chmod "$env_mode" "$env_tmp"
    mv -f -- "$env_tmp" "$API_ENV"
    ENV_CHANGED=1

    [[ "$(grep -Fxc "JOBFINDER_APP_ORIGIN=https://$DOMAIN" "$API_ENV")" == '1' ]] \
        || die 'failed to set the exact application origin once'
    [[ "$(grep -Ec '^JOBFINDER_APP_ORIGIN=' "$API_ENV")" == '1' ]] \
        || die 'application origin remains duplicated'

    systemctl restart "$API_UNIT"
    wait_for_api_health
}

verify_public_site() {
    local root_body
    local health_body
    local jobs_body
    local mutation_code
    local redirect_headers
    local unknown_code
    local unknown_rc
    local api_memory_bytes
    local edge_memory_bytes
    local combined_mib
    local api_listeners

    log 'Opening HTTPS only after the production certificate and final site validate'
    UFW443_ADDED=1
    ufw allow 443/tcp comment 'JobFinder HTTPS'

    root_body="$(curl --fail --silent --show-error --max-time 10 \
        --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")"
    grep -Fq '<div id="root"></div>' <<<"$root_body" || die 'HTTPS root did not return the expected Vite shell'

    health_body="$(curl --fail --silent --show-error --max-time 10 \
        --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health")"
    [[ "$health_body" == '{"ok":true,"database":"ok"}' ]] || die 'same-origin HTTPS health response is incorrect'

    jobs_body="$(curl --fail --silent --show-error --max-time 15 \
        --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/jobs?limit=100")"
    grep -Eq '"total"[[:space:]]*:[[:space:]]*31' <<<"$jobs_body" || die 'public jobs API did not report exactly 31 jobs'
    grep -Eq '"id"[[:space:]]*:[[:space:]]*"rv02"' <<<"$jobs_body" || die 'public jobs API is missing rv02'

    mutation_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 \
        --resolve "$DOMAIN:443:127.0.0.1" -X POST \
        -H 'Content-Type: application/json' --data '{}' "https://$DOMAIN/api/jobs")"
    [[ "$mutation_code" == '403' ]] || die "public mutation was not rejected at the edge (HTTP $mutation_code)"

    redirect_headers="$(curl --silent --show-error --head --max-time 10 \
        --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/" | tr -d '\r')"
    grep -Eq '^HTTP/[0-9.]+ 308' <<<"$redirect_headers" || die 'named HTTP request did not return a 308 redirect'
    grep -Fiqx "Location: https://$DOMAIN/" <<<"$redirect_headers" || die 'HTTP redirect target is incorrect'

    set +e
    unknown_code="$(curl --insecure --silent --output /dev/null --write-out '%{http_code}' --max-time 5 \
        --resolve 'unknown.invalid:443:127.0.0.1' 'https://unknown.invalid/')"
    unknown_rc=$?
    set -e
    [[ "$unknown_rc" -ne 0 && "$unknown_code" == '000' ]] || die 'unknown HTTPS host was not dropped by the default server'

    openssl x509 -in "$TLS_ROOT/current/fullchain.pem" -noout -checkhost "$DOMAIN" >/dev/null
    openssl x509 -in "$TLS_ROOT/current/fullchain.pem" -noout -checkend 604800 >/dev/null

    api_listeners="$(ss -H -lntup | awk -v port=":$API_PORT" '$1 == "tcp" && $5 ~ (port "$") { print }')"
    [[ -n "$api_listeners" ]] || die "API listener on $API_PORT disappeared"
    awk -v endpoint="127.0.0.1:$API_PORT" '$5 != endpoint { exit 1 }' <<<"$api_listeners" \
        || die "$API_PORT is no longer loopback-only"
    ss -H -lntup | awk '$1 == "tcp" && $5 ~ /:(80|443)$/ { print $5 }' | sort -u | \
        grep -Fxq '0.0.0.0:80' || die 'isolated edge is not listening on IPv4 port 80'
    ss -H -lntup | awk '$1 == "tcp" && $5 ~ /:(80|443)$/ { print $5 }' | sort -u | \
        grep -Fxq '0.0.0.0:443' || die 'isolated edge is not listening on IPv4 port 443'

    api_memory_bytes="$(systemctl show --property=MemoryCurrent --value "$API_UNIT")"
    edge_memory_bytes="$(systemctl show --property=MemoryCurrent --value "$EDGE_UNIT")"
    [[ "$api_memory_bytes" =~ ^[0-9]+$ && "$edge_memory_bytes" =~ ^[0-9]+$ ]] \
        || die 'could not read final JobFinder service memory use'
    combined_mib=$(( (api_memory_bytes + edge_memory_bytes + 1048575) / 1048576 ))
    (( combined_mib < STEADY_MEMORY_LIMIT_MIB )) || die "actual steady JobFinder memory is ${combined_mib} MiB, not below ${STEADY_MEMORY_LIMIT_MIB} MiB"
    log "Actual steady JobFinder memory: ${combined_mib} MiB"
}

verify_protected_state() {
    local global_active
    local global_enabled

    require_sha256 "$PROTECTED_IGST_SERVICE" "$EXPECTED_IGST_SERVICE_SHA256"
    require_sha256 "$PROTECTED_IGST_SITE_AVAILABLE" "$EXPECTED_IGST_NGINX_SHA256"
    require_sha256 "$PROTECTED_IGST_SITE_ENABLED" "$EXPECTED_IGST_NGINX_SHA256"

    global_active="$(systemctl is-active "$GLOBAL_NGINX_UNIT" 2>/dev/null || true)"
    global_enabled="$(systemctl is-enabled "$GLOBAL_NGINX_UNIT" 2>/dev/null || true)"
    [[ "$global_active" == 'inactive' ]] || die "$GLOBAL_NGINX_UNIT changed state to $global_active"
    [[ "$global_enabled" == 'disabled' ]] || die "$GLOBAL_NGINX_UNIT changed enablement to $global_enabled"

    systemctl is-active --quiet "$MYSQL_UNIT" || die "$MYSQL_UNIT is not active after deployment"
    run_replica_check
}

enable_new_units() {
    log 'Enabling only the isolated JobFinder edge and certificate timer'
    systemctl enable "$EDGE_UNIT"
    EDGE_ENABLED=1
    systemctl enable --now "$RENEW_TIMER"
    TIMER_ENABLED=1

    systemctl is-active --quiet "$EDGE_UNIT" || die "$EDGE_UNIT is not active"
    systemctl is-enabled --quiet "$EDGE_UNIT" || die "$EDGE_UNIT is not enabled"
    systemctl is-active --quiet "$RENEW_TIMER" || die "$RENEW_TIMER is not active"
    systemctl is-enabled --quiet "$RENEW_TIMER" || die "$RENEW_TIMER is not enabled"
}

main() {
    local mode
    local command_name
    local timers_before
    local timers_after_without_jobfinder
    local ufw_defaults_before
    local ufw_defaults_after

    case "$#" in
        0)
            mode='fresh'
            ;;
        1)
            [[ "$1" == '--resume-after-install' ]] \
                || die 'usage: install-jobfinder-public.sh [--resume-after-install]'
            mode='resume'
            ;;
        *)
            die 'usage: install-jobfinder-public.sh [--resume-after-install]'
            ;;
    esac

    log "Release root: $RELEASE_ROOT"
    log "Installer mode: $mode"
    for command_name in \
        awk chmod chown cmp cp curl date df diff find free getent grep groupadd id install \
        ln mktemp mv openssl readlink rm runuser sed sha256sum sleep sort ss stat \
        systemctl systemd-analyze tr ufw useradd /usr/sbin/nginx; do
        require_command "$command_name"
    done

    preflight_release
    preflight_server "$mode"
    snapshot_required_state

    timers_before="$(systemctl list-unit-files --type=timer --no-legend --no-pager \
        | grep -v -F "$RENEW_TIMER" | sort)"
    ufw_defaults_before="$(ufw status verbose | grep -E '^(Default:|New profiles:)')"

    log 'All read-only preflight gates passed; beginning isolated JobFinder changes'
    MUTATIONS_STARTED=1

    if [[ "$mode" == 'fresh' ]]; then
        install_files
    else
        log 'Skipping account/path/file creation because every retained artifact was verified'
    fi
    validate_units_and_bootstrap
    issue_certificates
    activate_https
    set_api_origin
    verify_public_site
    enable_new_units
    verify_protected_state

    timers_after_without_jobfinder="$(systemctl list-unit-files --type=timer --no-legend --no-pager \
        | grep -v -F "$RENEW_TIMER" | sort)"
    [[ "$timers_after_without_jobfinder" == "$timers_before" ]] \
        || die 'an existing timer unit or its enablement state changed'

    ufw_defaults_after="$(ufw status verbose | grep -E '^(Default:|New profiles:)')"
    [[ "$ufw_defaults_after" == "$ufw_defaults_before" ]] || die 'UFW defaults or profile policy changed'

    snapshot_required_state
    log 'Deployment completed: the public preview is available over HTTPS.'
    log "URL: https://$DOMAIN"

    # The backup is no longer needed after every final check passes.
    ENV_CHANGED=0
    rm -f -- "$ENV_BACKUP"
    ENV_BACKUP=''
}

main "$@"
