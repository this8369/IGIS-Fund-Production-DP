import { supabase } from './supabaseClient';
import { executeWithTimeout } from './supabaseHelper';

const TASK_SELECT = `
    id,
    project_code,
    task_name,
    task_purpose,
    deliverables,
    category_main,
    lead_dept_code,
    assignee,
    due_date,
    status,
    priority_score,
    task_type,
    created_at,
    lead_dept:iota_departments!lead_dept_code(dept_name)
`;
const TASK_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPmoTasks = null;
let cachedPmoTasksAt = 0;
let pendingPmoTasksRequest = null;

export const PMO_PROJECT_LABELS = {
    IOTA_SEOUL: 'IOTA 공통',
    PFV_427: '427 PFV',
    PFV_816: '816 PFV',
    FUND_421: '421 Fund',
    EXTERNAL: '외부',
};

const compareTasksByCreatedAt = (firstTask, secondTask) => {
    const firstCreatedAt = firstTask?.created_at ? new Date(firstTask.created_at).getTime() : 0;
    const secondCreatedAt = secondTask?.created_at ? new Date(secondTask.created_at).getTime() : 0;
    if (firstCreatedAt !== secondCreatedAt) return firstCreatedAt - secondCreatedAt;
    return String(firstTask?.id || '').localeCompare(String(secondTask?.id || ''));
};

const normalizeTask = (task, index) => ({
    id: task.id,
    displayId: `T-${String(index + 1).padStart(3, '0')}`,
    projectCode: task.project_code,
    taskName: task.task_name,
    taskPurpose: task.task_purpose,
    deliverables: task.deliverables,
    categoryMain: task.category_main,
    leadDeptCode: task.lead_dept_code,
    leadDeptName: task.lead_dept?.dept_name || '',
    assignee: task.assignee,
    dueDate: task.due_date,
    status: task.status,
    priorityScore: task.priority_score,
    createdAt: task.created_at,
});

export const fetchPmoTaskOptions = async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && cachedPmoTasks && now - cachedPmoTasksAt < TASK_CACHE_TTL_MS) {
        return cachedPmoTasks;
    }
    if (!force && pendingPmoTasksRequest) return pendingPmoTasksRequest;

    pendingPmoTasksRequest = (async () => {
        const { data, error } = await executeWithTimeout(
            supabase
                .schema('iota_v2')
                .from('iota_pmo_tasks')
                .select(TASK_SELECT)
                .neq('task_type', '팝업')
                .order('created_at', { ascending: true })
                .order('id', { ascending: true })
        );

        if (error) throw error;
        cachedPmoTasks = [...(data || [])]
            .sort(compareTasksByCreatedAt)
            .map(normalizeTask);
        cachedPmoTasksAt = Date.now();
        return cachedPmoTasks;
    })().finally(() => {
        pendingPmoTasksRequest = null;
    });

    return pendingPmoTasksRequest;
};

const normalizeTaskIds = (taskIds) => [...new Set(
    (taskIds || []).filter(Boolean).map(String)
)];

export const fetchLogTaskIds = async (logId, metadataTaskIds = []) => {
    const normalizedMetadataTaskIds = normalizeTaskIds(metadataTaskIds);
    if (!logId) return normalizedMetadataTaskIds;
    const { data, error } = await executeWithTimeout(
        supabase
            .from('iota_seoul_log_links')
            .select('proj_id')
            .eq('log_id', String(logId))
            .eq('relation_type', 'pmo_task')
            .order('created_at', { ascending: true })
    );

    if (error) {
        if (normalizedMetadataTaskIds.length > 0) {
            console.error('Workspace post task link index could not be loaded.', error);
            return normalizedMetadataTaskIds;
        }
        throw error;
    }
    return normalizeTaskIds([
        ...normalizedMetadataTaskIds,
        ...(data || []).map((link) => link.proj_id),
    ]);
};

export const fetchLinkedTasksByLogIds = async (logsOrIds) => {
    const entries = (logsOrIds || []).filter(Boolean);
    const normalizedLogIds = [...new Set(entries.map((entry) => (
        typeof entry === 'object' ? entry.log_id : entry
    )).filter(Boolean).map(String))];
    if (normalizedLogIds.length === 0) return {};

    const taskIdsByLogId = entries.reduce((groupedTaskIds, entry) => {
        if (typeof entry !== 'object' || !entry.log_id) return groupedTaskIds;
        const metadataTaskIds = normalizeTaskIds(entry.metadata?.linked_pmo_task_ids);
        if (metadataTaskIds.length > 0) {
            groupedTaskIds[String(entry.log_id)] = metadataTaskIds;
        }
        return groupedTaskIds;
    }, {});

    const logIdsWithoutMetadata = normalizedLogIds.filter((logId) => (
        !taskIdsByLogId[logId]?.length
    ));
    if (logIdsWithoutMetadata.length > 0) {
        const { data: linkRows, error: linkError } = await executeWithTimeout(
            supabase
                .from('iota_seoul_log_links')
                .select('log_id, proj_id')
                .in('log_id', logIdsWithoutMetadata)
                .eq('relation_type', 'pmo_task')
        );

        if (linkError && Object.keys(taskIdsByLogId).length === 0) throw linkError;
        if (linkError) {
            console.error('Workspace post task link index could not be loaded.', linkError);
        }
        (linkRows || []).forEach((link) => {
            const logId = String(link.log_id);
            taskIdsByLogId[logId] = normalizeTaskIds([
                ...(taskIdsByLogId[logId] || []),
                link.proj_id,
            ]);
        });
    }

    const linkedTaskIds = normalizeTaskIds(Object.values(taskIdsByLogId).flat());
    if (linkedTaskIds.length === 0) return {};

    const tasks = await fetchPmoTaskOptions();
    const taskById = new Map(tasks.map((task) => [String(task.id), task]));

    return Object.entries(taskIdsByLogId).reduce((groupedTasks, [logId, taskIds]) => {
        const linkedTasks = taskIds
            .map((taskId) => taskById.get(String(taskId)))
            .filter(Boolean);
        if (linkedTasks.length > 0) groupedTasks[logId] = linkedTasks;
        return groupedTasks;
    }, {});
};

export const replaceLogTaskLinks = async (logId, taskIds) => {
    if (!logId) return;
    const normalizedTaskIds = normalizeTaskIds(taskIds);
    const existingTaskIds = await fetchLogTaskIds(logId);
    const existingTaskIdSet = new Set(existingTaskIds.map(String));
    const selectedTaskIdSet = new Set(normalizedTaskIds);
    const taskIdsToInsert = normalizedTaskIds.filter((taskId) => !existingTaskIdSet.has(taskId));
    const taskIdsToDelete = existingTaskIds.filter((taskId) => !selectedTaskIdSet.has(String(taskId)));

    if (taskIdsToInsert.length > 0) {
        const { error: insertError } = await executeWithTimeout(
            supabase
                .from('iota_seoul_log_links')
                .insert(taskIdsToInsert.map((selectedTaskId) => ({
                    link_id: `link_${logId}_task_${selectedTaskId}`,
                    log_id: String(logId),
                    proj_id: selectedTaskId,
                    relation_type: 'pmo_task',
                })))
        );
        if (insertError) throw insertError;
    }

    if (taskIdsToDelete.length > 0) {
        const { error: deleteError } = await executeWithTimeout(
            supabase
                .from('iota_seoul_log_links')
                .delete()
                .eq('log_id', String(logId))
                .eq('relation_type', 'pmo_task')
                .in('proj_id', taskIdsToDelete)
        );
        if (deleteError) throw deleteError;
    }
};
