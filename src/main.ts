import { connect } from 'amqplib';
import { Throttle } from './Throttle';

const THROTTLE_EXCHANGE_NAME = 'throttle';
const THROTTLE_EXCHANGE_FANOUT_NAME = 'throttle.remove';

interface Options {
	pattern: string;
}

async function main(): Promise<void> {
	const throttle = new Throttle({
		rabbitUrl: 'amqp://guest:guest@localhost',
		rabbitHttpUrl: 'http://guest:guest@localhost:15672',
		pattern: 'request',
		users: () => {
			return {
				1: 1,
				2: 1,
				3: 1,
				4: 1,
				5: 5,
			};
		},
		consumeHandler: async ({ connection, channel, message }) => {
			if (!message) {
				return;
			}
			console.log('request');
			await channel.ack(message);
		},
	});
	await throttle.init();
	console.log('Started');
}

main().catch(console.log);
