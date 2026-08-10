const PNG_PROFILE_NAMES = new Set(['김현진', '남민호']);

export const getProfileImageSrc = (name) => {
    const cleanName = String(name || '').split('(')[0];
    const extension = PNG_PROFILE_NAMES.has(cleanName) ? 'png' : 'webp';
    return `${import.meta.env.BASE_URL}${cleanName}.${extension}`;
};
