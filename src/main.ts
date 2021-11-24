import * as fs from 'fs';
import { Throttle } from './Throttle';

async function main(): Promise<void> {
	const throttle = new Throttle({
		rabbit: {
			amqp: 'amqp://guest:guest@localhost',
			http: 'http://guest:guest@localhost:15672',
		},
		pattern: 'request',
		users: () => {
			let raw = fs.readFileSync(__dirname + '/../users.json');
			let users = JSON.parse(raw.toString());
			return users;
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
