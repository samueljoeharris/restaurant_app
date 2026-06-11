#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI is not installed in this cloud-agent environment" >&2
  exit 1
fi

ensure_socket_access() {
  if [[ ! -S /var/run/docker.sock ]]; then
    return 0
  fi

  sudo chgrp docker /var/run/docker.sock >/dev/null 2>&1 || true
  sudo chmod 660 /var/run/docker.sock >/dev/null 2>&1 || true
  sudo setfacl -m "u:$(id -un):rw" /var/run/docker.sock >/dev/null 2>&1 || true
}

docker_ready() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if sudo docker info >/dev/null 2>&1; then
    ensure_socket_access
    docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1
    return
  fi

  return 1
}

dockerd_pid_is_running() {
  local pid

  if [[ ! -f /var/run/docker.pid ]]; then
    return 1
  fi

  pid="$(sudo sed -n '1p' /var/run/docker.pid 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  sudo kill -0 "$pid" >/dev/null 2>&1
}

if docker_ready; then
  echo "Docker daemon is already running"
  exit 0
fi

sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true

if command -v service >/dev/null 2>&1; then
  sudo service docker start >/dev/null 2>&1 || true
fi

for _ in {1..30}; do
  if docker_ready; then
    echo "Docker daemon is running"
    exit 0
  fi
  sleep 1
done

if dockerd_pid_is_running; then
  echo "dockerd is running but docker info is not ready" >&2
  exit 1
fi

echo "Docker service did not start; launching dockerd directly" >&2
sudo dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &

for _ in {1..30}; do
  if docker_ready; then
    echo "Docker daemon is running"
    exit 0
  fi
  sleep 1
done

echo "Docker daemon failed to start. Recent dockerd logs:" >&2
sudo sed -n '1,160p' /tmp/dockerd.log >&2 || true
exit 1
