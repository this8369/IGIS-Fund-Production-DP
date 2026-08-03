import React from 'react';

export default function PmoCategoryMap() {
    const [selectedCategory, setSelectedCategory] = React.useState('PMO');

    const categories = ['PMO', '호텔/운영', '인허가', '금융/LFC', '마케팅'];

    const matrixData = {
        'PMO': {
            lead: '사업2파트',
            coop: ['LFC', '공간솔루션'],
            deliverables: ['주간 공정율 통계', 'Blocker 의사결정 원장', '사업성 지표 스냅샷']
        },
        '호텔/운영': {
            lead: '기업마케팅',
            coop: ['사업2파트', '공간솔루션'],
            deliverables: ['브랜드 제안서', '앵커 테넌트 LOI', 'MD 기획 도면']
        },
        '인허가': {
            lead: '개발솔루션',
            coop: ['공간솔루션', '사업2파트'],
            deliverables: ['건축 허가 신청서', '지방심의 의결로그', '민원 협의록']
        },
        '금융/LFC': {
            lead: 'LFC(금융)',
            coop: ['사업2파트'],
            deliverables: ['PF 인출 스케줄', '대주단 선/후순위 확정서', '리파이낸싱 약정서']
        },
        '마케팅': {
            lead: '기업마케팅',
            coop: ['사업2파트'],
            deliverables: ['테넌트 유치 브로셔', '가중평균 잔여 임대기간(WALT) 시트', '임차의향서(LOI)']
        }
    };

    const current = matrixData[selectedCategory] || {};

    return (
        <div className="w-full flex-1 flex flex-col pt-[28px] pb-[60px] max-w-[1200px] mx-auto select-text">
            {/* Header */}
            <div className="w-full flex justify-between items-start mb-[32px]">
                <div>
                    <h1 className="text-[32px] font-bold text-white tracking-tight leading-none mb-[8px]">조직별 R&R</h1>
                    <p className="text-[16px] text-[#86868B] leading-[26px]">대분류별 실행주관/협업 R&R 및 필수 산출물 계층 구조 시각화</p>
                </div>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex gap-[8px] mb-[24px]">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-[16px] py-[6px] rounded-full text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            selectedCategory === cat
                                ? 'text-white border-[1px] border-transparent [background:linear-gradient(#1F1F1E,#1F1F1E)_padding-box,linear-gradient(to_bottom_right,#d6efe9,#82afb9,#4c6e86)_border-box]'
                                : 'bg-transparent border border-[#333] text-[#86868B] hover:text-white hover:border-[#555]'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* R&R Diagram Map */}
            <div className="w-full border border-[#3c3c3c] bg-[#272726] rounded-[24px] p-8 flex flex-col gap-6 font-sans">
                <div className="grid grid-cols-2 gap-8">
                    {/* Left: Roles */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-[#1f1f1e] border border-[#3c3c3c] rounded-xl p-5">
                            <span className="text-[10px] font-bold text-[#2997ff] uppercase tracking-wider">실행주관 (LEAD DEPARTMENT)</span>
                            <div className="text-[20px] font-bold text-white mt-2 text-left">
                                {current.lead}
                            </div>
                        </div>

                        <div className="bg-[#1f1f1e] border border-[#3c3c3c] rounded-xl p-5">
                            <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">협업 부서 (COOP DEPARTMENTS)</span>
                            <div className="flex gap-2 mt-3">
                                {current.coop?.map((c, i) => (
                                    <span key={i} className="text-[13px] font-bold bg-[#2d2d2d] border border-[#3c3c3c] px-3 py-1 rounded-lg text-white">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Deliverables List */}
                    <div className="bg-[#1f1f1e] border border-[#3c3c3c] rounded-xl p-5 flex flex-col">
                        <span className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-wider mb-3">필수 산출물 (REQUIRED DELIVERABLES)</span>
                        <div className="flex flex-col gap-3 flex-1">
                            {current.deliverables?.map((d, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-[#272726] border border-[#3c3c3c] rounded-lg">
                                    <span className="text-[#F59E0B] font-mono text-[12px] font-bold">[{i+1}]</span>
                                    <span className="text-[13px] text-white font-medium text-left">{d}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
