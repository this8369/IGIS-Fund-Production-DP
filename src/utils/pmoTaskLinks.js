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

export const fetchPmoTaskOptions = async () => {
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
    return [...(data || [])]
        .sort(compareTasksByCreatedAt)
        .map(normalizeTask);
};

export const fetchLogTaskIds = async (logId) => {
    if (!logId) return [];
    const { data, error } = await executeWithTimeout(
        supabase
            .from('iota_seoul_log_links')
            .select('proj_id')
            .eq('log_id', String(logId))
            .eq('relation_type', 'pmo_task')
            .order('created_at', { ascending: true })
    );

    if (error) throw error;
    return (data || []).map((link) => link.proj_id).filter(Boolean);
};

export const fetchLinkedTasksByLogIds = async (logIds) => {
    const normalizedLogIds = [...new Set((logIds || []).filter(Boolean).map(String))];
    if (normalizedLogIds.length === 0) return {};

    const { data: linkRows, error: linkError } = await executeWithTimeout(
        supabase
            .from('iota_seoul_log_links')
            .select('link_id, log_id, proj_id, created_at')
            .in('log_id', normalizedLogIds)
            .eq('relation_type', 'pmo_task')
            .order('created_at', { ascending: true })
    );

    if (linkError) throw linkError;
    if (!linkRows?.length) return {};

    const tasks = await fetchPmoTaskOptions();
    const taskById = new Map(tasks.map((task) => [String(task.id), task]));

    return linkRows.reduce((groupedTasks, link) => {
        const task = taskById.get(String(link.proj_id));
        if (!task) return groupedTasks;
        if (!groupedTasks[link.log_id]) groupedTasks[link.log_id] = [];
        groupedTasks[link.log_id].push(task);
        return groupedTasks;
    }, {});
};

export const replaceLogTaskLinks = async (logId, taskIds) => {
    if (!logId) return;
    const normalizedTaskIds = [...new Set((taskIds || []).filter(Boolean).map(String))];
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
