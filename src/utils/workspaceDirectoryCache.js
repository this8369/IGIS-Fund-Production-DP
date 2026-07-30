import { supabase } from './supabaseClient';

const DIRECTORY_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedWorkspaceDirectory = null;
let cachedWorkspaceDirectoryAt = 0;
let pendingWorkspaceDirectoryRequest = null;

export const fetchWorkspaceDirectoryData = async ({ force = false } = {}) => {
    const hasFreshCache = (
        cachedWorkspaceDirectory
        && Date.now() - cachedWorkspaceDirectoryAt < DIRECTORY_CACHE_TTL_MS
    );

    if (!force && hasFreshCache) return cachedWorkspaceDirectory;
    if (!force && pendingWorkspaceDirectoryRequest) return pendingWorkspaceDirectoryRequest;

    pendingWorkspaceDirectoryRequest = (async () => {
        const [stakeholdersResult, pilotMembersResult] = await Promise.all([
            supabase
                .from('iota_stakeholder_master')
                .select('*')
                .limit(5000),
            supabase
                .from('iota_seoul_pilot_members')
                .select('auth_id, email, staff_name, org_name, role_code, workspace_code, is_active'),
        ]);

        if (stakeholdersResult.error) throw stakeholdersResult.error;
        if (pilotMembersResult.error) throw pilotMembersResult.error;

        cachedWorkspaceDirectory = {
            stakeholders: stakeholdersResult.data || [],
            pilotMembers: pilotMembersResult.data || [],
        };
        cachedWorkspaceDirectoryAt = Date.now();
        return cachedWorkspaceDirectory;
    })().finally(() => {
        pendingWorkspaceDirectoryRequest = null;
    });

    return pendingWorkspaceDirectoryRequest;
};

export const fetchCachedStakeholderMaster = async ({ force = false } = {}) => {
    const directory = await fetchWorkspaceDirectoryData({ force });
    return directory.stakeholders;
};
