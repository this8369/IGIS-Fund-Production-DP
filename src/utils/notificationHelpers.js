import { supabase } from './supabaseClient';
import { resolveMentionedAuthIds } from './mentionHelpers.js';

const VIP_AUTH_IDS = [
    '4d855717-1e30-4c50-9c5a-621740e686b6', // 이시정
    '492127cc-eb2a-4522-bf25-68640ebc326b', // 이관용
    '9ba52276-9705-4230-a12d-984f999833f4'  // 전기영
];

export const notifyVIPsOnTaskCreation = async (taskId, taskName, workspaceName, workspaceCode) => {
    if (!taskName) return;
    
    const notificationPayload = VIP_AUTH_IDS.map(userId => ({
        user_id: userId,
        title: `[${workspaceName}] 신규 Task 등록`,
        body: `새로운 Task가 등록되었습니다: ${taskName}`,
        type: 'task',
        reference_id: taskId && workspaceCode ? `${taskId}|${workspaceCode}` : null,
        is_read: false,
        created_at: new Date().toISOString()
    }));

    try {
        const { error } = await supabase
            .from('iota_notifications')
            .insert(notificationPayload);
            
        if (error) {
            console.error('Failed to insert VIP notifications:', error);
        } else {
            console.log('VIP notifications sent for task:', taskName);
        }
    } catch (err) {
        console.error('Error in notifyVIPsOnTaskCreation:', err);
    }
};

/**
 * 협업글(Log) 생성 시 워크스페이스 소속원 및 마스터/디렉터에게 알림 전송 (비동기 백그라운드 구동 권장)
 */
export const notifyMembersOnLogCreation = async (logId, logContent, workspace, writerEmail, mentions = []) => {
    if (!logId || !workspace?.code) return;

    try {
        // 1. 활성화 상태이고 auth_id가 매핑된 멤버 전체 조회
        const { data: members, error: memberError } = await supabase
            .from('iota_seoul_pilot_members')
            .select('auth_id, email, staff_name, org_name, role_code, workspace_code')
            .eq('is_active', true)
            .not('auth_id', 'is', null);

        if (memberError) {
            console.error('Failed to fetch members for notifications:', memberError);
            return;
        }

        // 2. 작성자 정보 및 멘션(@) 파싱 (담당자와 담당부서 구성원 전체 처리)
        const writerMember = members.find(m => m.email && writerEmail && m.email.toLowerCase() === writerEmail.toLowerCase());
        const writerName = writerMember ? writerMember.staff_name : '누군가';
        const mentionedAuthIds = resolveMentionedAuthIds({
            members,
            content: logContent,
            mentions,
            writerEmail,
        });

        // 3. 수신자 매핑 알고리즘:
        let recipientIds = [];

        if (workspace.code === 'WS_PMO' || workspace.code === 'WS_POPUP_REQUESTS') {
            // [통합업무보드]는 작성자 본인 및 작성자가 속한 부서의 멤버만 일반 알림 수신 대상에 포함 (멘션 대상자는 멘션 알림으로 별도 처리)
            const creatorMember = members.find(m => m.email && writerEmail && m.email.toLowerCase() === writerEmail.toLowerCase());
            if (creatorMember) {
                recipientIds.push(creatorMember.auth_id);
                if (creatorMember.org_name) {
                    members.forEach(m => {
                        if (m.org_name === creatorMember.org_name) {
                            recipientIds.push(m.auth_id);
                        }
                    });
                }
            }
        } else {
            // 일반 워크스페이스는 기존 로직 적용
            const recipientIdsRaw = members
                .filter(member => {
                    const isPMO = workspace.code === 'WS_PMO' || workspace.code === 'WS_POPUP_REQUESTS';
                    if (isPMO) return true;
                    
                    const orgMatch = workspace.orgNames && workspace.orgNames.includes(member.org_name);
                    const codeMatch = member.workspace_code === workspace.code;
                    const isSameWorkspace = orgMatch || codeMatch;
                    
                    const isDirectorOrMaster = member.role_code === 'master' || member.role_code === 'director';

                    return (isSameWorkspace || isDirectorOrMaster);
                })
                .map(member => member.auth_id);
            recipientIds = recipientIdsRaw;
        }

        const uniqueRecipientIds = [...new Set(recipientIds)];

        // 일반 알림 대상자 중에서 언급(태그) 대상자를 제외하여 중복 수신 방지
        const ordinaryRecipientIds = uniqueRecipientIds.filter(id => !mentionedAuthIds.includes(id));

        const summaryText = logContent.length > 80 ? logContent.slice(0, 80) + '...' : logContent;
        const notificationPayload = [];

        if (workspace.code === 'WS_PMO' || workspace.code === 'WS_POPUP_REQUESTS') {
            // [통합업무보드] 전용 포맷 및 줄바꿈 적용
            let taskName = '';
            try {
                const { data: logRow } = await supabase
                    .from('iota_seoul_logs')
                    .select('metadata')
                    .eq('log_id', logId)
                    .single();
                if (logRow && logRow.metadata?.task_id) {
                    const { data: taskRow } = await supabase
                        .schema('iota_v2')
                        .from('iota_pmo_tasks')
                        .select('task_name')
                        .eq('id', logRow.metadata.task_id)
                        .single();
                    if (taskRow) {
                        taskName = taskRow.task_name;
                    }
                }
            } catch (e) {
                console.error('Failed to resolve task name for log notification:', e);
            }

            // 내용: 한줄 넘어가면 .. 처리 및 줄바꿈 공백 대체
            const singleLineText = logContent.replace(/\r?\n/g, ' ').trim();
            const truncatedText = singleLineText.length > 28 
                ? singleLineText.slice(0, 28) + '..' 
                : singleLineText;

            const formattedBody = taskName 
                ? `업무명 : ${taskName}\n내용 : ${truncatedText}` 
                : truncatedText;

            ordinaryRecipientIds.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[${workspace.label}]에 새 글이 등록됐습니다.`,
                    body: formattedBody,
                    type: 'log',
                    reference_id: `${logId}|${workspace.code}`,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });

            mentionedAuthIds.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[${workspace.label}]에 새 글이 등록됐습니다.`,
                    body: formattedBody,
                    type: 'log',
                    reference_id: `${logId}|${workspace.code}`,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });
        } else {
            // 일반 알림 페이로드 추가
            ordinaryRecipientIds.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[${workspace.label}] 신규 업무 메시지`,
                    body: summaryText,
                    type: 'log',
                    reference_id: `${logId}|${workspace.code}`,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });

            // 언급(태그) 알림 페이로드 추가
            mentionedAuthIds.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[@언급] ${writerName}님이 업무 메시지에서 회원님을 태그했습니다.`,
                    body: summaryText,
                    type: 'log',
                    reference_id: `${logId}|${workspace.code}`,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });
        }

        if (notificationPayload.length === 0) {
            console.log('No recipients to notify for log:', logId);
            return;
        }

        // 4. iota_notifications 테이블에 개별 Insert 진행 (Stale auth_id 외래키 오류 방지)
        const insertPromises = notificationPayload.map(payload => 
            supabase
                .from('iota_notifications')
                .insert(payload)
                .then(({ error }) => {
                    if (error) {
                        console.error(`Failed to insert log notification for user ${payload.user_id}:`, error.message);
                    }
                })
        );
        await Promise.all(insertPromises);
        console.log(`Log notifications successfully processed for ${notificationPayload.length} payloads (Mentions: ${mentionedAuthIds.length}).`);

        // 5. DB 트리거에 의해 자동 생성되는 중복 알림(본문 내용이 원본과 동일한 단순 알림) 즉시 삭제 처리
        try {
            await supabase
                .from('iota_notifications')
                .delete()
                .is('reference_id', null)
                .eq('body', logContent)
                .ilike('title', '[%');
            console.log('Successfully cleaned up duplicate DB-trigger notifications.');
        } catch (delErr) {
            console.warn('Failed to clean up duplicate notifications:', delErr);
        }
    } catch (err) {
        console.error('Error in notifyMembersOnLogCreation:', err);
    }
};

/**
 * Task 생성 시 워크스페이스 소속원 및 마스터/디렉터에게 알림 전송 (비동기 백그라운드 구동 권장)
 */
export const notifyMembersOnTaskCreation = async (taskId, taskName, workspace, writerEmail) => {
    if (!taskName || !workspace?.code) return;

    try {
        // 1. 활성화 상태이고 auth_id가 매핑된 멤버 전체 조회
        const { data: members, error: memberError } = await supabase
            .from('iota_seoul_pilot_members')
            .select('auth_id, email, staff_name, org_name, role_code, workspace_code')
            .eq('is_active', true)
            .not('auth_id', 'is', null);

        if (memberError) {
            console.error('Failed to fetch members for task notifications:', memberError);
            return;
        }

        // 2. 수신자 매핑 알고리즘:
        let recipientIds = [];
        let mentionedAuthIds = [];

        if (workspace.code === 'WS_PMO') {
            // [통합업무보드]는 작성자 본인 + 작성자가 속한 부서의 멤버 + 담당자 + 실행주관 + 협조부서 + @멘션 대상자에게만 발송
            const creatorMember = members.find(m => m.email && writerEmail && m.email.toLowerCase() === writerEmail.toLowerCase());
            if (creatorMember) {
                recipientIds.push(creatorMember.auth_id);
                if (creatorMember.org_name) {
                    members.forEach(m => {
                        if (m.org_name === creatorMember.org_name) {
                            recipientIds.push(m.auth_id);
                        }
                    });
                }
            }

            try {
                const { data: task } = await supabase
                    .schema('iota_v2')
                    .from('iota_pmo_tasks')
                    .select('*, lead_dept:iota_departments!lead_dept_code(dept_name)')
                    .eq('id', taskId)
                    .single();

                if (task) {
                    // 담당자 지정
                    if (task.assignee && task.assignee !== '미정') {
                        const assigneeMember = members.find(m => m.staff_name === task.assignee);
                        if (assigneeMember) {
                            mentionedAuthIds.push(assigneeMember.auth_id);
                        }
                    }
                    
                    // 실행주관 지정
                    const leadDeptName = task.lead_dept?.dept_name || task.lead_dept_code;
                    if (leadDeptName) {
                        members.forEach(m => {
                            if (m.org_name && (m.org_name === leadDeptName || m.org_name.includes(leadDeptName))) {
                                mentionedAuthIds.push(m.auth_id);
                            }
                        });
                    }

                    // 협조부서 지정
                    if (task.coop_dept_codes) {
                        const depts = task.coop_dept_codes.split(/[,;/]+/).map(d => d.trim()).filter(Boolean);
                        depts.forEach(deptName => {
                            members.forEach(m => {
                                if (m.org_name && (m.org_name === deptName || m.org_name.includes(deptName))) {
                                    mentionedAuthIds.push(m.auth_id);
                                }
                            });
                        });
                    }

                    // 텍스트 내 @멘션
                    const combinedText = `${task.task_name || ''} ${task.task_purpose || ''} ${task.deliverables || ''} ${task.notes || ''}`;
                    const mentionMatches = [...combinedText.matchAll(/@([가-힣a-zA-Z0-9]+)/g)].map(m => m[1]);
                    members.forEach(m => {
                        if (mentionMatches.includes(m.staff_name) || mentionMatches.includes(m.org_name)) {
                            mentionedAuthIds.push(m.auth_id);
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to query task for notifications:', err);
            }
        } else {
            // 일반 워크스페이스는 기존 로직 적용
            const TASK_VIP_NAMES = ['이시정', '이관용', '전기영', '이철승', '강순용', '권순일'];
            const recipientIdsRaw = members
                .filter(member => {
                    const orgMatch = workspace.orgNames && workspace.orgNames.includes(member.org_name);
                    const codeMatch = member.workspace_code === workspace.code;
                    const isSameWorkspace = orgMatch || codeMatch;

                    const isDirectorOrMaster = member.role_code === 'master' || member.role_code === 'director';
                    const isTaskVIP = TASK_VIP_NAMES.includes(member.staff_name);

                    return (isSameWorkspace || isDirectorOrMaster || isTaskVIP);
                })
                .map(member => member.auth_id);
            recipientIds = recipientIdsRaw;
        }

        const uniqueRecipientIds = [...new Set(recipientIds)];
        const finalMentions = [...new Set(mentionedAuthIds)];
        
        // 일반 알림 대상자 중에서 언급(태그) 대상자를 제외하여 중복 수신 방지
        const ordinaryRecipientIds = uniqueRecipientIds.filter(id => !finalMentions.includes(id));

        const notificationPayload = [];

        if (workspace.code === 'WS_PMO') {
            ordinaryRecipientIds.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[${workspace.label}]에 새 글이 등록됐습니다.`,
                    body: `업무명 : ${taskName}`,
                    type: 'task',
                    reference_id: taskId ? `${taskId}|${workspace.code}` : null,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });

            finalMentions.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[${workspace.label}]에 새 글이 등록됐습니다.`,
                    body: `업무명 : ${taskName}`,
                    type: 'task',
                    reference_id: taskId ? `${taskId}|${workspace.code}` : null,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });
        } else {
            const allRecipients = [...new Set([...ordinaryRecipientIds, ...finalMentions])];
            allRecipients.forEach(userId => {
                notificationPayload.push({
                    user_id: userId,
                    title: `[${workspace.label}] 새 글이 등록되었습니다.`,
                    body: taskName,
                    type: 'task',
                    reference_id: taskId ? `${taskId}|${workspace.code}` : null,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            });
        }

        if (notificationPayload.length === 0) {
            console.log('No recipients to notify for task:', taskName);
            return;
        }

        const insertPromises = notificationPayload.map(payload => 
            supabase
                .from('iota_notifications')
                .insert(payload)
                .then(({ error }) => {
                    if (error) {
                        console.error(`Failed to insert task notification for user ${payload.user_id}:`, error.message);
                    }
                })
        );
        await Promise.all(insertPromises);
        console.log(`Task notifications successfully processed for ${notificationPayload.length} payloads.`);
    } catch (err) {
        console.error('Error in notifyMembersOnTaskCreation:', err);
    }
};

/**
 * 댓글(Comment) 생성 시 워크스페이스 소속원, 글 작성자 및 멘션(@) 대상자에게 알림 전송
 */
export const notifyMembersOnCommentCreation = async (logId, commentContent, workspace, writerEmail) => {
    // DB 트리거에 의해 '[댓글][워크스페이스] 새 댓글이 등록되었습니다.' 알림이 자동으로 생성되므로,
    // 클라이언트 측에서 중복으로 알림을 발송하지 않도록 본 함수는 실행을 생략합니다.
    console.log('Skipping client-side notifyMembersOnCommentCreation to prevent duplicate comment notifications.');
};
