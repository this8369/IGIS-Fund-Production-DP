import {
    getMemberIotaOrganization,
    IOTA_ORGANIZATION_ORDER,
} from './iotaOrganizations.js';

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasMentionToken = (content, label) => {
    if (!content || !label) return false;
    const pattern = new RegExp(`(^|\\s)@${escapeRegExp(label)}(?=\\s|$|[.,!?;:()[\\]{}])`, 'u');
    return pattern.test(content);
};

const normalizeMentionEntity = (mention) => {
    if (!mention) return null;
    if (typeof mention === 'string') {
        return { type: 'person', label: mention.trim() };
    }

    const type = mention.type === 'department' ? 'department' : 'person';
    const label = String(mention.label || mention.name || '').trim();
    return label ? { type, label } : null;
};

export const buildMentionCandidates = (members = []) => {
    const activeMembers = members.filter((member) => (
        member?.staff_name
        && member?.auth_id
        && member?.is_active !== false
    ));
    const departmentMap = new Map();
    const personMap = new Map();

    activeMembers.forEach((member) => {
        const organization = getMemberIotaOrganization(member, '');
        if (organization && organization !== '공통' && !departmentMap.has(organization)) {
            departmentMap.set(organization, {
                type: 'department',
                label: organization,
                organization,
            });
        }

        if (!personMap.has(member.staff_name)) {
            personMap.set(member.staff_name, {
                type: 'person',
                label: member.staff_name,
                organization,
            });
        }
    });

    const departments = [...departmentMap.values()].sort((left, right) => {
        const leftIndex = IOTA_ORGANIZATION_ORDER.indexOf(left.label);
        const rightIndex = IOTA_ORGANIZATION_ORDER.indexOf(right.label);
        if (leftIndex === -1 && rightIndex === -1) return left.label.localeCompare(right.label, 'ko');
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
    });
    const people = [...personMap.values()].sort((left, right) => left.label.localeCompare(right.label, 'ko'));

    return [...departments, ...people];
};

export const getActiveMentionEntities = (content, mentions = []) => {
    const uniqueMentions = new Map();

    mentions
        .map(normalizeMentionEntity)
        .filter(Boolean)
        .filter((mention) => hasMentionToken(content, mention.label))
        .forEach((mention) => {
            uniqueMentions.set(`${mention.type}:${mention.label}`, mention);
        });

    return [...uniqueMentions.values()];
};

export const resolveMentionedAuthIds = ({
    members = [],
    content = '',
    mentions = [],
    writerEmail = '',
}) => {
    const activeMentions = getActiveMentionEntities(content, mentions);
    const explicitlyMentionedPeople = new Set(
        activeMentions
            .filter((mention) => mention.type === 'person')
            .map((mention) => mention.label)
    );
    const explicitlyMentionedDepartments = new Set(
        activeMentions
            .filter((mention) => mention.type === 'department')
            .map((mention) => mention.label)
    );
    const normalizedWriterEmail = String(writerEmail || '').toLowerCase();

    const recipientIds = members
        .filter((member) => (
            member?.auth_id
            && member?.is_active !== false
            && String(member.email || '').toLowerCase() !== normalizedWriterEmail
        ))
        .filter((member) => {
            const organization = getMemberIotaOrganization(member, '');
            const isExplicitPerson = explicitlyMentionedPeople.has(member.staff_name);
            const isExplicitDepartment = explicitlyMentionedDepartments.has(organization);
            const isTypedPersonMention = hasMentionToken(content, member.staff_name);
            const isTypedDepartmentMention = organization && hasMentionToken(content, organization);

            return isExplicitPerson || isExplicitDepartment || isTypedPersonMention || isTypedDepartmentMention;
        })
        .map((member) => member.auth_id);

    return [...new Set(recipientIds)];
};
