import { Channel, connect, Connection, ConsumeMessage, Replies } from 'amqplib';
import { RabbitApi } from './RabbitApi';
import Consume = Replies.Consume;

export type UserKey = string;
export type NumberOfConsumers = number;

export type Users = Record<UserKey, NumberOfConsumers>;

export type ConsumeHandler = (payload: {
	message: ConsumeMessage | null;
	connection: Connection | null;
	channel: Channel | null;
}) => Promise<void>;

export interface Options {
	pattern: string;
	rabbit: {
		amqp: string;
		http: string;
	};
	users: () => Users;
	consumeHandler: ConsumeHandler;
	exchangeName?: string;
	exchangeFanoutName?: string;
	connection?: Connection;
	syncCronJob?: {
		start: boolean; // start the cron sync job
		interval: number; // sync interval in seconds
	};
}

export enum EXCHANGE {
	name = 'throttle',
	fanout = 'throttle.remove',
}

export class Throttle {
	private readonly consumers: Record<string, string[]>;
	private rabbitApi: RabbitApi;
	private connection: Connection | null;
	private internalChannel: Channel | null;
	private clientChannel: Channel | null;
	private exchangeName: string = EXCHANGE.name;
	private exchangeFanoutName: string = EXCHANGE.fanout;

	public constructor(private options: Options) {
		this.consumers = {};
		this.rabbitApi = new RabbitApi(options.rabbit.http);
		this.connection = null;
		this.internalChannel = null;
		this.clientChannel = null;
	}

	private get addQueueName(): string {
		return `${this.options.pattern}.add`;
	}

	private get removeQueueName(): string {
		return `${this.options.pattern}.remove`;
	}

	private get syncQueueName(): string {
		return `${this.options.pattern}.sync`;
	}

	public async init(): Promise<void> {
		this.connection =
			this.options.connection || (await connect(this.options.rabbit.amqp));

		this.exchangeName = this.options.exchangeName || EXCHANGE.name;
		this.exchangeFanoutName =
			this.options.exchangeFanoutName || EXCHANGE.fanout;

		this.internalChannel = await this.connection.createChannel();
		this.clientChannel = await this.connection.createChannel();

		await this.internalChannel.assertExchange(this.exchangeName, 'direct');
		await this.internalChannel.assertExchange(
			this.exchangeFanoutName,
			'fanout'
		);

		await this.internalChannel.assertQueue(this.addQueueName, {});
		await this.internalChannel.assertQueue(this.removeQueueName, {});
		await this.internalChannel.assertQueue(this.syncQueueName, {});

		await this.internalChannel.bindQueue(
			this.addQueueName,
			this.exchangeName,
			this.addQueueName
		);
		await this.internalChannel.bindQueue(
			this.syncQueueName,
			this.exchangeName,
			this.syncQueueName
		);
		await this.internalChannel.bindQueue(
			this.removeQueueName,
			this.exchangeFanoutName,
			this.removeQueueName
		);

		await this.internalChannel.consume(
			this.addQueueName,
			this.addHandler.bind(this)
		);
		await this.internalChannel.consume(
			this.removeQueueName,
			this.removeHandler.bind(this)
		);

		await this.internalChannel.consume(
			this.syncQueueName,
			this.syncHandler.bind(this)
		);
		if (this.options.syncCronJob?.start) {
			setInterval(
				this.publishSyncMessage.bind(this),
				this.options.syncCronJob.interval * 1000
			);
		}
	}

	private async publishSyncMessage() {
		this.internalChannel?.publish(
			this.exchangeName,
			this.syncQueueName,
			Buffer.from('')
		);
	}

	private async syncHandler(msg: ConsumeMessage | null) {
		if (!msg || !this.internalChannel) {
			return;
		}
		try {
			const consumers = await this.rabbitApi.getConsumers();
			const allQueues = await this.rabbitApi.getQueues();

			const mapConsumers = consumers.reduce<
				Record<string, { nr: number; tags: string[] }>
			>((acc, c) => {
				if (acc[c.queue.name]) {
					acc[c.queue.name].nr += 1;
					acc[c.queue.name].tags.push(c.consumer_tag);
					return acc;
				}
				acc[c.queue.name] = {
					nr: 1,
					tags: [c.consumer_tag],
				};
				return acc;
			}, {});

			const users = await this.options.users();
			const usersQueues = Object.keys(users).reduce<Record<string, number>>(
				(acc, e) => {
					acc[`${this.options.pattern}.${e}`] = users[e];
					return acc;
				},
				{}
			);

			for (const [userQueue, desiredNrOfConsumers] of Object.entries(
				usersQueues
			)) {
				const exists = mapConsumers[userQueue];
				if (!exists) {
					for (let i = 0; i < desiredNrOfConsumers; i++) {
						this.addQueue(userQueue);
					}
					continue;
				}
				const { nr: actualNumberOfConsumers, tags } = mapConsumers[userQueue];
				if (desiredNrOfConsumers > actualNumberOfConsumers) {
					for (
						let i = 0;
						i < desiredNrOfConsumers - actualNumberOfConsumers;
						i++
					) {
						this.addQueue(userQueue);
					}
					continue;
				}
				if (desiredNrOfConsumers < actualNumberOfConsumers) {
					const nrOfConsumersToRemove =
						actualNumberOfConsumers - desiredNrOfConsumers;
					const consumersToRemove = tags.slice(0, nrOfConsumersToRemove);
					for (let i = 0; i < consumersToRemove.length; i++) {
						this.removeQueue(userQueue, consumersToRemove);
					}
				}
			}

			const queuesForRemove = allQueues
				.filter((c) => {
					return (
						new RegExp(`^${this.options.pattern}`).test(c.name) &&
						!usersQueues[c.name] &&
						![
							this.addQueueName,
							this.removeQueueName,
							this.syncQueueName,
						].includes(c.name)
					);
				})
				.map((c) => {
					return { name: c.name, consumers: c.consumers };
				});

			if (queuesForRemove.length) {
				for (const { name, consumers } of queuesForRemove) {
					if (consumers > 0) {
						this.removeQueue(name, mapConsumers[name]?.tags);
					} else {
						await this.clientChannel?.deleteQueue(name);
					}
				}
			}
		} catch (err) {
			console.log(`[ERROR] in sync handler ${err.message}`);
		}

		await this.internalChannel.ack(msg);
	}

	private async removeHandler(msg: ConsumeMessage | null) {
		if (!msg || !this.clientChannel) {
			return;
		}
		const { queueName, tags: tagsForRemove } = JSON.parse(
			msg?.content.toString()
		);
		if (!queueName) {
			return;
		}
		const tags = this.consumers[queueName];
		if (tags && tags.length) {
			for (const tag of tagsForRemove) {
				if (tags.includes(tag)) {
					await this.clientChannel?.cancel(tag);
				}
			}
		}
		await this.internalChannel?.ack(msg);
	}

	private async addHandler(msg: ConsumeMessage | null) {
		if (!msg || !this.internalChannel || !this.clientChannel) {
			return;
		}
		const queueName = msg?.content.toString();
		if (!queueName) {
			await this.internalChannel.ack(msg);
			return;
		}
		await this.clientChannel.assertQueue(queueName, {
			maxPriority: 10,
		});
		const consume: Consume = await this.clientChannel.consume(
			queueName,
			async (message) =>
				this.options.consumeHandler({
					message,
					channel: this.clientChannel,
					connection: this.connection,
				})
		);
		const tags = this.consumers[queueName] || [];
		tags.push(consume.consumerTag);
		this.consumers[queueName] = tags;
		await this.internalChannel.ack(msg);
	}

	private addQueue(queueName: string) {
		this.internalChannel?.publish(
			this.exchangeName,
			this.addQueueName,
			Buffer.from(queueName)
		);
	}

	private removeQueue(queueName: string, tags: string[]) {
		this.internalChannel?.publish(
			this.exchangeFanoutName,
			this.removeQueueName,
			Buffer.from(
				JSON.stringify({
					queueName: queueName,
					tags,
				})
			)
		);
	}
}
