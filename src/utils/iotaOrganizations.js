export const IOTA_WORKSPACES = [
    { code: 'WS_PM1', label: '사업1파트', taskTable: 'iota_pm_tasks', orgNames: ['사업1파트'] },
    { code: 'WS_PM2', label: '사업2파트', taskTable: 'iota_pm_tasks', orgNames: ['사업2파트'] },
    { code: 'WS_LFC', label: 'LFC', taskTable: 'iota_financing_tasks', orgNames: ['LFC'] },
    { code: 'WS_DSC', label: '개발솔루션', taskTable: 'iota_development_tasks', orgNames: ['개발솔루션'] },
    { code: 'WS_EMC', label: '기업마케팅', taskTable: 'iota_marketing_tasks', orgNames: ['기업마케팅'] },
    { code: 'WS_SSC', label: '공간솔루션', taskTable: 'iota_digital_tasks', orgNames: ['공간솔루션'] },
    { code: 'WS_KAM', label: 'KAM', taskTable: 'iota_fund_tasks', orgNames: ['KAM'] },
    { code: 'WS_IPR', label: 'IPR', taskTable: 'iota_ipr_tasks', orgNames: ['IPR'] },
];

export const IOTA_ORGANIZATION_ORDER = [
    '사업1파트',
    '사업2파트',
    'LFC',
    '개발솔루션',
    '기업마케팅',
    '공간솔루션',
    'KAM',
    'IPR',
    '기획추진',
    'CFT 총괄',
    '공통',
];

const PM1_MEMBERS = new Set(['권순일', '윤주형', '김제익', '류홍', '박만진', '박일훈', '이정원', '전무경']);
const PM2_MEMBERS = new Set(['강순용', '한찬호', '박석제', '박채현', '소현준', '이수정', '조영비', '한수정']);
const PLANNING_MEMBERS = new Set(['전기영', '이시정', '이관용']);
const CFT_MEMBERS = new Set(['이철승', '윤관식', '정조민', '우형석']);
const LFC_MEMBERS = new Set(['박준호', '강석민', '정리훈', '손유정', '김지우', '박현승', '이성민A', '한승환']);
const DEVELOPMENT_MEMBERS = new Set(['홍장군', '채원', '김보성', '전승희', '김대익', '장성진', '이정훈', '박봉서', '김형주']);
const MARKETING_MEMBERS = new Set(['김민지', '고아라']);
const SPATIAL_MEMBERS = new Set(['김현수', '현철호', '신민호', '이가현', '정수명', '임수빈']);
const KAM_MEMBERS = new Set(['김행단']);
const IPR_MEMBERS = new Set(['윤용택']);

const WORKSPACE_CODE_ALIASES = {
    WS_PM1: ['WS_PM1', 'WS_PM'],
    WS_PM2: ['WS_PM2', 'WS_PM'],
    WS_LFC: ['WS_LFC', 'WS_FINANCING'],
    WS_DSC: ['WS_DSC', 'WS_DEVELOPMENT'],
    WS_EMC: ['WS_EMC', 'WS_MARKETING'],
    WS_SSC: ['WS_SSC', 'WS_DIGITAL'],
    WS_KAM: ['WS_KAM', 'WS_FUND'],
    WS_IPR: ['WS_IPR'],
};

const compactOrganizationName = (value) => String(value || '')
    .trim()
    .replace(/[\s·/_-]+/g, '')
    .toUpperCase();

export const normalizeIotaOrganization = (value, fallback = '') => {
    const sourceName = typeof value === 'object' ? value?.dept_name : value;
    const organizationName = String(sourceName || '').trim();
    const compactName = compactOrganizationName(organizationName);

    if (!compactName) return fallback;
    if (['사업그룹1파트', '사업관리1파트', '사업파트1', '사업PM1', 'PM1', 'DEPTPM1', 'WSPM1'].includes(compactName) || compactName.includes('사업1파트')) return '사업1파트';
    if (['사업그룹2파트', '사업관리2파트', '사업파트2', '사업PM2', 'PM2', 'DEPTPM2', 'WSPM2'].includes(compactName) || compactName.includes('사업2파트')) return '사업2파트';
    if (['개발관리', '개발관리실', '개발솔루션센터', '개발솔루션DSC', 'DEPTDEV', 'WSDEVELOPMENT', 'WSDSC'].includes(compactName) || compactName.includes('개발솔루션')) return '개발솔루션';
    if (['상품디지털', '설계실', '공간솔루션실', '공간솔루션센터', '공간솔루션SSC', 'DEPTDESIGN', 'WSDIGITAL', 'WSSSC'].includes(compactName) || compactName.includes('공간솔루션')) return '공간솔루션';
    if (['마케팅팀', '기업마케팅실', '기업마케팅센터', '기업마케팅EMC', 'DEPTMKT', 'WSMARKETING', 'WSEMC'].includes(compactName) || compactName.includes('기업마케팅')) return '기업마케팅';
    if (['파이낸싱', '파이낸싱LFC', 'LFC금융', 'DEPTLFC', 'WSFINANCING', 'WSLFC'].includes(compactName) || compactName.startsWith('LFC')) return 'LFC';
    if (['펀드운용', '펀드운용KAM', 'DEPTKAM', 'WSFUND', 'WSKAM'].includes(compactName) || compactName.startsWith('KAM')) return 'KAM';
    if (['IPRWG', 'DEPTIPR', 'WSIPR'].includes(compactName) || compactName.startsWith('IPR')) return 'IPR';
    if (['전부서', 'DEPTALL'].includes(compactName)) return '전부서';
    if (compactName.includes('기획추진')) return '기획추진';
    if (compactName.includes('CFT') || compactName.includes('총괄')) return 'CFT 총괄';
    return organizationName;
};

export const normalizeIotaWorkspaceCode = (value, staffName = '') => {
    const workspaceCode = String(value || '').trim().toUpperCase();
    if (workspaceCode === 'WS_PM') return PM2_MEMBERS.has(staffName) ? 'WS_PM2' : 'WS_PM1';
    if (workspaceCode === 'WS_DEVELOPMENT') return 'WS_DSC';
    if (workspaceCode === 'WS_MARKETING') return 'WS_EMC';
    if (workspaceCode === 'WS_DIGITAL') return 'WS_SSC';
    if (workspaceCode === 'WS_FINANCING') return 'WS_LFC';
    if (workspaceCode === 'WS_FUND') return 'WS_KAM';
    return workspaceCode;
};

export const getIotaOrganizationByStaff = (staffName, fallback = '공통') => {
    if (PLANNING_MEMBERS.has(staffName)) return '기획추진';
    if (CFT_MEMBERS.has(staffName)) return 'CFT 총괄';
    if (PM1_MEMBERS.has(staffName)) return '사업1파트';
    if (PM2_MEMBERS.has(staffName)) return '사업2파트';
    if (LFC_MEMBERS.has(staffName)) return 'LFC';
    if (DEVELOPMENT_MEMBERS.has(staffName)) return '개발솔루션';
    if (MARKETING_MEMBERS.has(staffName)) return '기업마케팅';
    if (SPATIAL_MEMBERS.has(staffName)) return '공간솔루션';
    if (KAM_MEMBERS.has(staffName)) return 'KAM';
    if (IPR_MEMBERS.has(staffName)) return 'IPR';
    return fallback;
};

export const getIotaStaffNamesByOrganization = (organizationName) => {
    const normalizedOrganization = normalizeIotaOrganization(organizationName);
    const membersByOrganization = {
        사업1파트: PM1_MEMBERS,
        사업2파트: PM2_MEMBERS,
        LFC: LFC_MEMBERS,
        개발솔루션: DEVELOPMENT_MEMBERS,
        기업마케팅: MARKETING_MEMBERS,
        공간솔루션: SPATIAL_MEMBERS,
        KAM: KAM_MEMBERS,
        IPR: IPR_MEMBERS,
    };
    return [...(membersByOrganization[normalizedOrganization] || [])];
};

export const getIotaWorkspaceCodeAliases = (workspaceCode) => {
    const normalizedCode = normalizeIotaWorkspaceCode(workspaceCode);
    return [...(WORKSPACE_CODE_ALIASES[normalizedCode] || [normalizedCode].filter(Boolean))];
};

export const getIotaOrganizationFromWorkspace = (workspaceCode, staffName = '', fallback = '') => {
    const normalizedCode = normalizeIotaWorkspaceCode(workspaceCode, staffName);
    const workspace = IOTA_WORKSPACES.find(({ code }) => code === normalizedCode);
    return workspace?.label || fallback;
};

export const getMemberIotaOrganization = (memberInfo, fallback = '전체') => {
    const staffName = memberInfo?.staff_name || memberInfo?.name || '';
    const organizationByName = normalizeIotaOrganization(memberInfo?.org_name);
    if (IOTA_ORGANIZATION_ORDER.includes(organizationByName)) return organizationByName;

    const organizationByWorkspace = getIotaOrganizationFromWorkspace(
        memberInfo?.workspace_code,
        staffName
    );
    if (IOTA_ORGANIZATION_ORDER.includes(organizationByWorkspace)) return organizationByWorkspace;

    const organizationByStaff = getIotaOrganizationByStaff(staffName, '');
    return IOTA_ORGANIZATION_ORDER.includes(organizationByStaff)
        ? organizationByStaff
        : fallback;
};

export const canOpenDirectorReportSource = (memberInfo) => {
    const roleCode = String(memberInfo?.role_code || '').trim().toLowerCase();
    return roleCode === 'director'
        || getMemberIotaOrganization(memberInfo, '') === '기획추진';
};

export const normalizeIotaDepartmentList = (value) => {
    const values = Array.isArray(value)
        ? value
        : String(value || '').split(/[,;]+/);
    return [...new Set(values.map((item) => normalizeIotaOrganization(item)).filter(Boolean))];
};
