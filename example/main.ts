import { Throttle } from '../src/Throttle';
import * as fs from 'fs';

async function main(): Promise<void> {
	const throttle = new Throttle({
		rabbit: {
			amqp: 'amqp://guest:guest@localhost',
			http: 'http://guest:guest@localhost:15672',
		},
		pattern: 'request',
		users: () => {
			// let raw = fs.readFileSync(__dirname + '/../users.json');
			// let users = JSON.parse(raw.toString());
			// return users;
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
			start: true,
			interval: 5,
		},
	});
	await throttle.init();
	console.log('Started');
}

main().catch(console.log);
