import { connect } from 'amqplib';

const THROTTLE_EXCHANGE_NAME = 'throttle';
const THROTTLE_EXCHANGE_FANOUT_NAME = 'throttle.remove';

interface Options {
	user: string;
}

async function main(): Promise<void> {
	const conn = await connect('amqp://localhost');

	const internalChannel = await conn.createChannel();
	const clientChannel = await conn.createChannel();

	await internalChannel.assertExchange(THROTTLE_EXCHANGE_NAME, 'direct');
	await internalChannel.assertExchange(
		THROTTLE_EXCHANGE_FANOUT_NAME,
		'fanout'
	);

	await internalChannel.assertQueue('add', {});
	await internalChannel.assertQueue('remove', {});

	await internalChannel.bindQueue('add', THROTTLE_EXCHANGE_NAME, '');
	await internalChannel.bindQueue(
		'remove',
		THROTTLE_EXCHANGE_FANOUT_NAME,
		''
	);

	await internalChannel.consume('add', async (msg) => {
		console.log('add');
	});
	await internalChannel.consume('remove', async (msg) => {
		console.log('remove');
	});
}

main().catch(console.log);
