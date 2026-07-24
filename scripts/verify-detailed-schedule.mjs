import assert from 'node:assert/strict';
import {
    IOTA_DETAILED_SCHEDULE_FALLBACK,
    IOTA_SCHEDULE_PERIODS,
} from '../src/data/iotaDetailedSchedule.js';

const items = IOTA_DETAILED_SCHEDULE_FALLBACK;
const periodKeys = IOTA_SCHEDULE_PERIODS.map((period) => period.key);
const periodIndex = new Map(periodKeys.map((key, index) => [key, index]));
const itemKeys = new Set(items.map((item) => item.sourceKey));
const tasks = items.filter((item) => item.itemType === 'task');

assert.equal(periodKeys.length, 24);
assert.equal(new Set(periodKeys).size, periodKeys.length);
assert.equal(items.length, 91);
assert.equal(itemKeys.size, items.length);
assert.equal(items.filter((item) => item.itemType === 'lv1').length, 8);
assert.equal(items.filter((item) => item.itemType === 'lv2').length, 16);
assert.equal(tasks.length, 67);
assert.equal(tasks.filter((item) => item.startPeriod && item.endPeriod).length, 41);
assert.equal(tasks.filter((item) => !item.startPeriod || !item.endPeriod).length, 26);
assert.equal(items.filter((item) => item.milestonePeriod).length, 5);

items.forEach((item, index) => {
    assert.equal(item.sourceOrder, index + 1);
    assert.equal(item.sourceKey, `S-${String(index + 1).padStart(3, '0')}`);

    if (item.parentSourceKey) {
        assert.ok(itemKeys.has(item.parentSourceKey), `${item.sourceKey} parent is missing`);
    } else {
        assert.equal(item.itemType, 'lv1');
    }

    for (const period of [item.startPeriod, item.endPeriod, item.milestonePeriod].filter(Boolean)) {
        assert.ok(periodIndex.has(period), `${item.sourceKey} has an invalid period`);
    }

    if (item.startPeriod && item.endPeriod) {
        assert.ok(
            periodIndex.get(item.startPeriod) <= periodIndex.get(item.endPeriod),
            `${item.sourceKey} has a reversed schedule range`,
        );
    }

    assert.doesNotMatch(
        item.leadLabel || '',
        /사업(?:그룹|관리)\d파트|사업파트\d|개발관리실|공간솔루션실|기업마케팅실/,
        `${item.sourceKey} has a legacy organization label`,
    );
});

console.log('Detailed schedule verified: 91 items / 67 tasks / 41 scheduled / 26 unscheduled / 5 milestones');
