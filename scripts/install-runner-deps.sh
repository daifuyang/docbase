#!/usr/bin/env bash
# =============================================================================
# DocBase — 在内网 VPS runner 上执行一次的工具链初始化脚本。
#
# 跑这条脚本的机器：阿里云上海/杭州 ECS，绑 label `fc-deploy,docbase`，
# 已经在 GitHub Org/Repo 上注册成 actions self-hosted runner。
#
# 跑完以后，runner 就有：
#   - pnpm (Node 20) + node itself
#   - postgresql16-client (psql)
#   - redis-tools (redis-cli)
#   - aliyun CLI
#   - env-config CLI (用于 set-config / get-config 访问 .aliyun/config.json)
#   - @serverless-devs/s (Serverless Devs)
#   - certbot + dns-aliyun plugin (Let's Encrypt 续签)
#   - jq, curl, tar, gzip, openssl
#
# 同时创建 $HOME/.aliyun 目录结构，把 cred.ini 准备好供 certbot-dns-aliyun 用。
# =============================================================================
set -euo pipefail

if [ "$(id -u)" = "0" ]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "▶ installing OS packages"
$SUDO apt-get update
$SUDO apt-get install -y \
  curl wget jq tar gzip openssl ca-certificates \
  postgresql-16-client \
  redis-tools \
  python3-pip

echo "▶ installing certbot + dns-aliyun"
$SUDO apt-get install -y certbot python3-certbot-dns-aliyun || pip3 install --break-system-packages certbot-dns-aliyun

echo "▶ installing aliyun CLI"
curl -fsSL https://aliyuncli.alicdn.com/aliyun-cli-linux-latest.tar.gz \
  | $SUDO tar -C /usr/local -xz
$SUDO ln -sf /usr/local/bin/aliyun /usr/local/bin/aliyun || true

echo "▶ installing env-config (set-config/get-config helper)"
$SUDO pip3 install --break-system-packages aliyun-cli-configure || pip3 install --break-system-packages aliyun-cli-configure
# alternative: npm i -g @serverless-devs/s-toolkit
# alternative: download static binary  https://github.com/aliyun/aliyun-cli/releases

echo "▶ installing Serverless Devs"
$SUDO npm i -g @serverless-devs/s

echo "▶ ensuring corepack + pnpm"
corepack enable
corepack prepare pnpm@9 --activate

echo "▶ preparing ~/.aliyun skeleton"
mkdir -p "$HOME/.aliyun"
if [ ! -f "$HOME/.aliyun/cred.ini" ]; then
  cat >"$HOME/.aliyun/cred.ini" <<'EOF'
# Used by certbot-dns-aliyun plugin
# Fill these BEFORE running renew-cert.sh for the first time.
dns_aliyun_access_key_id     = <REPLACE-ME>
dns_aliyun_access_key_secret = <REPLACE-ME>
dns_aliyun_region_id         = cn-shanghai
EOF
  chmod 600 "$HOME/.aliyun/cred.ini"
  echo "  ⚠️ Created $HOME/.aliyun/cred.ini — fill in AK/SK and chmod 600."
fi

if [ ! -f "$HOME/.aliyun/config.json" ]; then
  cat >"$HOME/.aliyun/config.json" <<'EOF'
{
  "current": "default",
  "profiles": [
    {
      "name": "default",
      "mode": "AK",
      "access_key_id": "<REPLACE-ME>",
      "access_key_secret": "<REPLACE-ME>",
      "sts_token": "",
      "ram_role_name": "",
      "ram_role_arn": "",
      "ram_session_name": "",
      "private_key": "",
      "key_pair_name": "",
      "expired_seconds": 0,
      "verified": "",
      "region_id": "cn-shanghai",
      "output_format": "json",
      "language": "zh"
    }
  ],
  "meta_path": ""
}
EOF
  chmod 600 "$HOME/.aliyun/config.json"
  echo "  ⚠️ Created $HOME/.aliyun/config.json — fill in access_key_id/access_key_secret."
fi

echo "▶ ensuring self-hosted runner is correctly tagged"
if [ -d /home/actions-runner ]; then
  echo "  → runner already installed at /home/actions-runner"
  $SUDO -u actions-runner /home/actions-runner/svc.sh status || true
else
  echo "  ⚠️ /home/actions-runner missing — install runner first:" >&2
  echo "      curl -fsSL https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz | tar xz"
  echo "      ./config.sh --url https://github.com/<owner>/docbase --token <RUNNER_TOKEN> --labels fc-deploy,docbase"
fi

echo
echo "✅ runner-deps ready."
echo "Next: bash scripts/apply-grants.sh   # initialize docbase_app on ECS PG"
echo "      bash scripts/apply-redis-acl.sh # initialize docbase_app on ECS Redis"
echo "      env-config set --profile docbase-prod --key ALIYUN_AK --value ...  # add all credentials"
