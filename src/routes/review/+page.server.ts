import type { PageServerLoad } from './$types';
import { loadReviewData } from '$lib/services/review-load.server';

export const load: PageServerLoad = async ({ url, platform, cookies }) => {
    return loadReviewData({ url, platform, cookies, skipAdvisor: false });
};
