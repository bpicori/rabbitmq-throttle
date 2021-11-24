// @ts-ignore
import { CH, PATTERN, USERS, VHOST_API } from './before';
import { assert } from 'chai';

interface AssertQueueParams {
	name: string;
	consumers: number;
	retry?: number;
}

export async function assertQueue({
	name,
	consumers,
	retry = 0,
}: AssertQueueParams): Promise<void> {
	if (retry < 5) {
		try {
			const queue = await VHOST_API.getQueue(name);
			assert.equal(queue.consumers, consumers);
		} catch (e) {
			await new Promise((r) => setTimeout(r, 5000));
			return assertQueue({ name, consumers, retry: (retry += 1) });
		}
	} else {
		const queue = await VHOST_API.getQueue(name);
		assert.equal(queue.consumers, consumers);
	}
}

export async function checkDeletedQueue(
	name: string,
	retry: number = 0
): Promise<void> {
	try {
		await VHOST_API.getQueue(name);
		if (retry < 5) {
			console.log('retrying...');
			await new Promise((r) => setTimeout(r, 5000));
			return checkDeletedQueue(name, (retry += 1));
		}
		assert(false, 'Queue still exists');
	} catch (err) {
		assert(true);
	}
}

function callSync() {
	CH.publish('throttle', `${PATTERN}.sync`, Buffer.from('{}'));
}

describe('RabbitMQ Throttle', async () => {
	it('should create add, remove, sync queues', async () => {
		await assertQueue({ name: `${PATTERN}.add`, consumers: 1 });
		await assertQueue({ name: `${PATTERN}.remove`, consumers: 1 });
		await assertQueue({ name: `${PATTERN}.sync`, consumers: 1 });
	});
	it('user one should has 1 consumer, user five 3 consumers', async () => {
		callSync();
		await assertQueue({ name: `${PATTERN}.1`, consumers: 1 });
		await assertQueue({ name: `${PATTERN}.2`, consumers: 1 });
		await assertQueue({ name: `${PATTERN}.5`, consumers: 3 });
	});
	it('add user six with 5 consumers', async () => {
		USERS['6'] = 5;
		callSync();
		await assertQueue({ name: `${PATTERN}.6`, consumers: 5 });
	});
	it('delete user two', async () => {
		delete USERS['2'];
		callSync();
		await assertQueue({ name: `${PATTERN}.2`, consumers: 0 });
		callSync();
		await checkDeletedQueue(`${PATTERN}.2`);
	});
});
