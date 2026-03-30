import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { downloadFormSchema } from '$lib/schemas/collection';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(downloadFormSchema));

	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod4(downloadFormSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Form is valid - client will handle the actual download
		// This action just validates the form data
		return { form };
	}
};
