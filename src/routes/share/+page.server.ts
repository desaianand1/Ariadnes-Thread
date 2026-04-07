import type { PageServerLoad } from './$types';
import { loadReviewData } from '$lib/services/review-load.server';
import { CURATOR_NAME_MAX_LENGTH } from '$lib/config/constants';

export const load: PageServerLoad = async ({ url, platform, cookies }) => {
    const curatorName = url.searchParams.get('by')?.slice(0, CURATOR_NAME_MAX_LENGTH) || undefined;

    const reviewData = await loadReviewData({
        url,
        platform,
        cookies,
        skipAdvisor: true
    });

    return {
        ...reviewData,
        curatorName
    };
};
