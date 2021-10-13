import { Throttle } from './Throttle';
import * as fs from 'fs';

async function main(): Promise<void> {
	const throttle = new Throttle({
		rabbit: {
			amqp: 'amqp://guest:guest@localhost/test',
			http: 'http://guest:guest@localhost:15672/test',
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
	});
	await throttle.init();
	console.log('Started');
}

main().catch(console.log);
