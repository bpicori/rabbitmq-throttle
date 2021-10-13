import { RabbitApi } from '../src/RabbitApi';
import { Throttle } from '../src/Throttle';
import fs from 'fs';
import { Channel, connect } from 'amqplib';

export const PATTERN = 'request-test';
export const RABBITMQ_URI =
	process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost';
export const RABBITMQ_HTTP = (process.env.RABBITMQ_HTTP =
	'http://guest:guest@localhost:15672');
export const VHOST = process.env.VHOST || 'test';
export const API = new RabbitApi(RABBITMQ_HTTP);
export const VHOST_API = new RabbitApi(`${RABBITMQ_HTTP}/${VHOST}`);
export let CH: Channel;
export const USERS: Record<string, number> = {
	'1': 1,
	'2': 1,
	'3': 1,
	'4': 1,
	'5': 3,
};

before(async () => {
	console.log('Creating VHOST ...');
	await API.createVhost(VHOST);
	const conn = await connect(`${RABBITMQ_URI}/${VHOST}`);
	CH = await conn.createChannel();
	const throttle = new Throttle({
		rabbit: {
			amqp: `${RABBITMQ_URI}/${VHOST}`,
			http: `${RABBITMQ_HTTP}/${VHOST}`,
		},
		pattern: PATTERN,
		users: () => {
			return USERS;
		},
		consumeHandler: async ({ connection, channel, message }) => {
			if (!message) {
				return;
			}
			await channel?.ack(message);
		},
	});
	await throttle.init();
});
