import axios, { AxiosInstance } from 'axios';
import { URL } from 'url';

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
	private readonly vhost: string;

	public constructor(private url: string) {
		const u = new URL(url);
		this.vhost =
			u.pathname === '/' ? '/' : u.pathname.slice(1, u.pathname.length);
		this.request = axios.create({
			baseURL: u.origin,
			auth: { username: u.username, password: u.password },
		});
	}

	public async createVhost(name: string) {
		const { data } = await this.request.put(`/api/vhosts/${name}`, {
			name,
		});
		return data;
	}

	public async deleteVhost(name: string) {
		const { data } = await this.request.delete(`/api/vhosts/${name}`);
		return data;
	}

	public async getQueues(): Promise<RabbitQueue[]> {
		const { data } = await this.request.get<RabbitQueue[]>(
			`/api/queues/${this.vhost}`
		);
		return data;
	}

	public async getQueue(name: string): Promise<RabbitQueue> {
		const { data } = await this.request.get<RabbitQueue>(
			`/api/queues/${this.vhost}/${name}`
		);
		return data;
	}

	public async getConsumers(): Promise<RabbitConsumers[]> {
		const { data } = await this.request.get<RabbitConsumers[]>(
			`/api/consumers/${this.vhost}`
		);
		return data;
	}
}
