-- ============================================================================
-- Database Setup Verification Script
-- Run this to verify your database is set up correctly
-- ============================================================================

\echo '═══════════════════════════════════════════════════════════════════'
\echo '  Database Setup Verification'
\echo '═══════════════════════════════════════════════════════════════════'
\echo ''

-- Check schema exists
\echo 'Checking schema...'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'game') THEN
        RAISE NOTICE '✓ game schema exists';
    ELSE
        RAISE EXCEPTION '✗ game schema NOT found - run the migration first!';
    END IF;
END $$;

-- Check tables
\echo ''
\echo 'Checking tables...'

SELECT 
    CASE 
        WHEN COUNT(*) = 10 THEN '✓ All 10 tables exist'
        ELSE '✗ Only ' || COUNT(*) || '/10 tables found'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'game';

-- List all tables
SELECT 
    table_name as table,
    'exists' as status
FROM information_schema.tables 
WHERE table_schema = 'game'
ORDER BY table_name;

-- Check RLS
\echo ''
\echo 'Checking Row Level Security...'

SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✓ enabled'
        ELSE '✗ disabled'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'game'
ORDER BY tablename;

-- Check policies
\echo ''
\echo 'Checking RLS policies...'

SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'game'
GROUP BY tablename
ORDER BY tablename;

-- Check realtime
\echo ''
\echo 'Checking Realtime configuration...'

SELECT 
    pubname as publication,
    CASE 
        WHEN pubinsert OR pubupdate OR pubdelete THEN '✓ active'
        ELSE '✗ inactive'
    END as realtime_status
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- Check indexes
\echo ''
\echo 'Checking indexes...'

SELECT 
    tablename,
    indexname
FROM pg_indexes 
WHERE schemaname = 'game'
ORDER BY tablename, indexname;

-- Count sample data
\echo ''
\echo 'Sample data counts:'

SELECT 
    'NPCs' as type,
    COUNT(*) as count
FROM game.agent_configs
UNION ALL
SELECT 
    'Object Templates' as type,
    COUNT(*) as count
FROM game.object_templates
UNION ALL
SELECT 
    'API Integrations' as type,
    COUNT(*) as count
FROM game.api_integrations;

-- Test RLS (as authenticated user would see)
\echo ''
\echo 'Testing data visibility...'

-- This shows what a player would see
SELECT 
    'Enabled NPCs visible to players' as check_type,
    COUNT(*) as count
FROM game.agent_configs 
WHERE enabled = true;

-- Final status
\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo '  Verification Complete!'
\echo '═══════════════════════════════════════════════════════════════════'
