import { supabase } from './supabaseClient';

const WORKSPACE_TASK_CACHE_TTL_MS = 60 * 1000;

const workspaceTaskCache = new Map();
const pendingWorkspaceTaskRequests = new Map();

export const fetchCachedWorkspaceTasks = async (tableName, { force = false } = {}) => {
    const cachedEntry = workspaceTaskCache.get(tableName);
    if (
        !force
        && cachedEntry
        && Date.now() - cachedEntry.cachedAt < WORKSPACE_TASK_CACHE_TTL_MS
    ) {
        return cachedEntry.tasks;
    }
    if (!force && pendingWorkspaceTaskRequests.has(tableName)) {
        return pendingWorkspaceTaskRequests.get(tableName);
    }

    const request = (async () => {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const tasks = data || [];
        workspaceTaskCache.set(tableName, {
            tasks,
            cachedAt: Date.now(),
        });
        return tasks;
    })().finally(() => {
        pendingWorkspaceTaskRequests.delete(tableName);
    });

    pendingWorkspaceTaskRequests.set(tableName, request);
    return request;
};

export const updateCachedWorkspaceTasks = (tableName, tasks) => {
    workspaceTaskCache.set(tableName, {
        tasks,
        cachedAt: Date.now(),
    });
};
