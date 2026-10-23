#!/bin/bash
# Verifies migrations + RLS/portal/payment security against a THROWAWAY local Postgres 15/16.
# Usage: PGHOST=localhost PGPORT=5432 PGUSER=postgres ./tests/db/run.sh
# Needs a superuser. It drops and recreates a database named "setest". Never point it at production.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; SQL="$HERE/../../sql"
PG="psql -q -v ON_ERROR_STOP=1 -U ${PGUSER:-postgres}"
$PG -d postgres -c "drop database if exists setest" -c "create database setest" >/dev/null
$PG -d setest -f "$HERE/shim.sql" >/dev/null   # minimal stand-in for Supabase auth/storage/roles
for f in 001_schema 002_rls 003_portal 004_storage 005_demo 006_booking_rpc; do $PG -d setest -f "$SQL/$f.sql" >/dev/null; done
$PG -d setest -f "$HERE/security.sql" 2>&1 | tee /tmp/se-sec.out | grep -E "FAIL|ERROR|COMPLETED" || true
echo "passes: $(grep -c PASS /tmp/se-sec.out)"; ! grep -q FAIL /tmp/se-sec.out
