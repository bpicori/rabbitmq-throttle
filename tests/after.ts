// @ts-ignore
import { API, VHOST } from './before';

after(async () => {
	console.log('Deleting VHOST ...');
	await API.deleteVhost(VHOST);
});
