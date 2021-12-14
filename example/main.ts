import { Throttle } from '../src';

async function main(): Promise<void> {
	const throttle = new Throttle({
		rabbit: {
			amqp: 'amqp://guest:guest@localhost',
			http: 'http://guest:guest@localhost:15672',
		},
		pattern: 'request',
		users: () => {
			return {
				'1': 1,
				'2': 1,
				'3': 1,
				'4': 1,
				'5': 3,
			};
		},
		consumeHandler: async ({ connection, channel, message }) => {
			if (!message) {
				return;
			}
			console.log('request');
			await channel?.ack(message);
		},
		syncCronJob: {
			start: false,
			interval: 5,
		},
	});
	await throttle.init();
	console.log('Started');
}

main().catch(console.log);
