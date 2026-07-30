import { supabase } from './supabaseClient';
import { fetchCachedStakeholderMaster } from './workspaceDirectoryCache';

const TASK_CACHE_TTL_MS = 30 * 1000;
const REFERENCE_CACHE_TTL_MS = 10 * 60 * 1000;
const ACTIVITY_CACHE_TTL_MS = 30 * 1000;

let cachedTasks = null;
let cachedTasksAt = 0;
let pendingTasksRequest = null;
let cachedReferenceData = null;
let cachedReferenceDataAt = 0;
let pendingReferenceDataRequest = null;
let cachedActiveTaskIds = null;
let cachedActiveTaskIdsAt = 0;
let pendingActiveTaskIdsRequest = null;

const unwrap = (result) => {
    if (result.error) throw result.error;
    return result.data || [];
};

export const getCachedPmoBoardTasks = () => {
    if (!cachedTasks || Date.now() - cachedTasksAt >= TASK_CACHE_TTL_MS) return null;
    return cachedTasks;
};

export const fetchPmoBoardTasks = async ({ force = false } = {}) => {
    const cached = getCachedPmoBoardTasks();
    if (!force && cached) return cached;
    if (pendingTasksRequest) return pendingTasksRequest;

    pendingTasksRequest = (async () => {
        const result = await supabase
            .schema('iota_v2')
            .from('iota_pmo_tasks')
            .select(`
                *,
                lead_dept:iota_departments!lead_dept_code(dept_name),
                external_party:iota_stakeholders!external_party_code(stakeholder_name)
            `)
            .neq('task_type', '팝업')
            .order('created_at', { ascending: true })
            .order('id', { ascending: true });

        cachedTasks = unwrap(result);
        cachedTasksAt = Date.now();
        return cachedTasks;
    })().finally(() => {
        pendingTasksRequest = null;
    });

    return pendingTasksRequest;
};

export const invalidatePmoBoardTasksCache = () => {
    cachedTasks = null;
    cachedTasksAt = 0;
};

export const fetchPmoBoardReferenceData = async ({ force = false } = {}) => {
    const hasFreshCache = (
        cachedReferenceData
        && Date.now() - cachedReferenceDataAt < REFERENCE_CACHE_TTL_MS
    );
    if (!force && hasFreshCache) return cachedReferenceData;
    if (pendingReferenceDataRequest) return pendingReferenceDataRequest;

    pendingReferenceDataRequest = (async () => {
        const [
            projectsResult,
            departmentsResult,
            stakeholdersResult,
            masterStakeholders,
            subsectorsResult,
            supportOptionsResult,
        ] = await Promise.all([
            supabase.schema('iota_v2').from('iota_projects').select('project_code, project_name'),
            supabase.schema('iota_v2').from('iota_departments').select('dept_code, dept_name'),
            supabase.schema('iota_v2').from('iota_stakeholders').select('stakeholder_code, stakeholder_name, category'),
            fetchCachedStakeholderMaster({ force }),
            supabase.schema('iota_v2').from('iota_subsectors').select('subsector_name'),
            supabase.schema('iota_v2').from('iota_support_options').select('option_name'),
        ]);

        cachedReferenceData = {
            projects: unwrap(projectsResult),
            departments: unwrap(departmentsResult),
            stakeholders: unwrap(stakeholdersResult),
            masterStakeholders,
            subsectors: unwrap(subsectorsResult).map(({ subsector_name: name }) => name),
            supportOptions: unwrap(supportOptionsResult).map(({ option_name: name }) => name),
        };
        cachedReferenceDataAt = Date.now();
        return cachedReferenceData;
    })().finally(() => {
        pendingReferenceDataRequest = null;
    });

    return pendingReferenceDataRequest;
};

export const fetchRecentPmoActiveTaskIds = async ({ force = false } = {}) => {
    const hasFreshCache = (
        cachedActiveTaskIds
        && Date.now() - cachedActiveTaskIdsAt < ACTIVITY_CACHE_TTL_MS
    );
    if (!force && hasFreshCache) return cachedActiveTaskIds;
    if (pendingActiveTaskIdsRequest) return pendingActiveTaskIdsRequest;

    pendingActiveTaskIdsRequest = (async () => {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const featureStartTime = '2026-07-13T09:02:39.000Z';
        const fetchStartTime = fortyEightHoursAgo > featureStartTime
            ? fortyEightHoursAgo
            : featureStartTime;
        const result = await supabase
            .from('iota_seoul_logs')
            .select('metadata')
            .gte('created_at', fetchStartTime)
            .contains('metadata', { is_task_board: true })
            .order('created_at', { ascending: false });

        cachedActiveTaskIds = new Set(
            unwrap(result)
                .map((log) => log.metadata?.task_id)
                .filter(Boolean)
        );
        cachedActiveTaskIdsAt = Date.now();
        return cachedActiveTaskIds;
    })().finally(() => {
        pendingActiveTaskIdsRequest = null;
    });

    return pendingActiveTaskIdsRequest;
};
