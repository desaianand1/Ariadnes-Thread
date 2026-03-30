import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { downloadFormSchema } from '$lib/schemas/collection';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(downloadFormSchema));

	return { form };
};
