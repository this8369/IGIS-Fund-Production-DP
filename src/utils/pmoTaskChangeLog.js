import { supabase } from './supabaseClient';

const mergeUniqueLines = (...lineGroups) => {
    const lines = lineGroups
        .flatMap(group => Array.isArray(group) ? group : String(group || '').split('\n'))
        .map(line => String(line || '').trim())
        .filter(Boolean);
    return [...new Set(lines)];
};

const mergeStructuredChanges = (...changeGroups) => {
    const changes = changeGroups
        .flatMap(group => Array.isArray(group) ? group : [])
        .filter(Boolean);
    const uniqueChanges = new Map();
    changes.forEach((change) => {
        const key = [change.field, change.from, change.to].join('|');
        if (!uniqueChanges.has(key)) uniqueChanges.set(key, change);
    });
    return [...uniqueChanges.values()];
};

export const savePmoTaskChangeLog = async ({
    taskId,
    taskProject,
    workspaceLabel,
    editorName,
    changes,
    structuredChanges = [],
    updateStartedAt,
}) => {
    if (!taskId || !Array.isArray(changes) || changes.length === 0) return null;

    const normalizedTaskId = String(taskId);
    const priorityLogPrefix = `pmo_priority_${normalizedTaskId.replace(/-/g, '')}_%`;
    const requestedStartedAt = new Date(updateStartedAt || Date.now()).getTime();
    const startedAt = new Date(
        (Number.isNaN(requestedStartedAt) ? Date.now() : requestedStartedAt) - 10000
    ).toISOString();
    const { data: priorityLogs, error: priorityLogError } = await supabase
        .from('iota_seoul_logs')
        .select('log_id, raw_text, metadata')
        .eq('metadata->>task_id', normalizedTaskId)
        .like('log_id', priorityLogPrefix)
        .gte('created_at', startedAt)
        .order('created_at', { ascending: false })
        .limit(1);

    if (priorityLogError) throw priorityLogError;

    const priorityLog = priorityLogs?.[0];
    if (priorityLog) {
        const mergedLines = mergeUniqueLines(changes, priorityLog.raw_text);
        const mergedStructuredChanges = mergeStructuredChanges(
            structuredChanges,
            priorityLog.metadata?.structured_changes
        );
        const metadata = {
            ...(priorityLog.metadata || {}),
            is_task_board: true,
            task_id: normalizedTaskId,
            task_project: taskProject || 'IOTA_SEOUL',
            workspace_code: 'WS_PMO',
            workspace_label: workspaceLabel,
            editor_name: editorName || priorityLog.metadata?.editor_name || '시스템',
            structured_changes: mergedStructuredChanges,
        };
        const { error: updateError } = await supabase
            .from('iota_seoul_logs')
            .update({
                raw_text: mergedLines.join('\n'),
                metadata,
            })
            .eq('log_id', priorityLog.log_id);
        if (updateError) throw updateError;
        return priorityLog.log_id;
    }

    const logId = `iota_issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const logData = {
        log_id: logId,
        writer_name: '시스템',
        writer_staff_id: 'system',
        work_date: new Date().toISOString().slice(0, 10),
        summary: '업무 변경 이력',
        raw_text: mergeUniqueLines(changes).join('\n'),
        input_status: 'submitted',
        source_system: 'task_board',
        metadata: {
            is_task_board: true,
            task_id: normalizedTaskId,
            task_project: taskProject || 'IOTA_SEOUL',
            workspace_code: 'WS_PMO',
            workspace_label: workspaceLabel,
            editor_name: editorName || '시스템',
            structured_changes: mergeStructuredChanges(structuredChanges),
        },
    };
    const { error: logError } = await supabase.from('iota_seoul_logs').insert(logData);
    if (logError) throw logError;

    const { error: linkError } = await supabase.from('iota_seoul_log_links').insert({
        link_id: `link_${logId}`,
        log_id: logId,
        proj_id: taskProject || 'IOTA_SEOUL',
        relation_type: 'direct_input',
    });
    if (linkError) throw linkError;
    return logId;
};
