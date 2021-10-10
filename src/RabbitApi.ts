import axios, { AxiosInstance } from 'axios';

export interface RabbitQueue {
	name: string;
	messages_ready: number;
	consumers: number;
}

export interface RabbitConsumers {
	consumer_tag: string;
	queue: {
		name: string;
	};
}

export class RabbitApi {
	private request: AxiosInstance;

	public constructor(private url: string) {
		this.request = axios.create({ baseURL: url });
	}

	public async getQueues(): Promise<RabbitQueue[]> {
		const { data } = await this.request.get<RabbitQueue[]>('/api/queues');
		return data;
	}

	public async getConsumers(): Promise<RabbitConsumers[]> {
		const { data } = await this.request.get<RabbitConsumers[]>(
			'/api/consumers'
		);
		return data;
	}
}
