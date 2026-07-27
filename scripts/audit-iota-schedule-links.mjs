import { writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('', process.cwd(), 'VITE_');
const email = process.env.IOTA_USER_EMAIL;
const password = process.env.IOTA_USER_PASSWORD;

if (!email || !password) {
    throw new Error('IOTA_USER_EMAIL and IOTA_USER_PASSWORD are required.');
}

const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) throw authError;

const [scheduleResult, taskResult] = await Promise.all([
    supabase
        .schema('iota_v2')
        .from('iota_schedule_items')
        .select(`
            id,
            source_key,
            source_order,
            item_type,
            parent_source_key,
            lv1,
            lv2,
            task_name,
            display_name,
            lead_dept_code,
            lead_label,
            category_main,
            start_period,
            end_period,
            linked_task_id
        `)
        .eq('is_active', true)
        .order('source_order', { ascending: true }),
    supabase
        .schema('iota_v2')
        .from('iota_pmo_tasks')
        .select(`
            id,
            project_code,
            category_main,
            sector_detail,
            task_name,
            task_purpose,
            deliverables,
            target_axis,
            gate_stage,
            lead_dept_code,
            coop_dept_codes,
            due_date,
            status,
            priority_score,
            meeting_grade,
            created_at
        `)
        .neq('task_type', '팝업')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
]);

if (scheduleResult.error) throw scheduleResult.error;
if (taskResult.error) throw taskResult.error;

const tasks = (taskResult.data || []).map((task, index) => ({
    display_id: `T-${String(index + 1).padStart(3, '0')}`,
    ...task
}));

const output = {
    generated_at: new Date().toISOString(),
    schedule_items: scheduleResult.data || [],
    tasks
};

await writeFile(
    '/private/tmp/iota-schedule-link-audit.json',
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8'
);

console.log(JSON.stringify({
    scheduleRows: output.schedule_items.length,
    scheduleTasks: output.schedule_items.filter((item) => item.item_type === 'task').length,
    pmoTasks: tasks.length,
    existingLinks: output.schedule_items.filter((item) => item.linked_task_id).length,
    output: '/private/tmp/iota-schedule-link-audit.json'
}, null, 2));
