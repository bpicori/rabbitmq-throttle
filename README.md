# RabbitMQ Throttle
### Motivation
Rabbitmq throttle is an utility package to handle parallelism in distributed systems, creating and deleting queues/consumers dynamically up to your configuration.
Imagine your application sending requests to Google Analytics API and you know the limits are 1 request per second for every user. Rabbitmq throttle creates one queue for every user and using rabbit RPC respects the API limits.
One other case is if you want to throttle database requests, creating write/read consumers based on your users.
### Usage

#### Install Package
```shell
npm install --save rabbitmq-throttle
```

#### Start throttle service


```typescript
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
		console.log(message.toString());
		await channel?.ack(message);
	},
});
await throttle.init();
```
RabbitMQ throttle creates 3 queues:
* *add* - creates new queue dynamically (don't publish to this queue, let the sync job do it)
* *remove* - removes queue dynamically (don't publish to this queue, let the sync job do it)
* *sync* - creates/removes queues based on the user's list. Configure a cron to trigger the job by simply publishing any message to this queue.

#### Properties
```typescript
interface Options {
	pattern: string; // add prefix when creating all queues
	rabbit: {
		amqp: string;
		http: string;
	};
	users: () => Users | Promise<User>; // method to get the configuration of users.
	consumeHandler: ConsumeHandler; // handler to bind for created queues
	exchangeName?: string; // optional name of the exchange, if not given will creates a default
	exchangeFanoutName?: string;
	connection?: Connection; // give an already initialize rabbit connection, if not it's creates a new one
	syncCronJob?: {
		start: boolean; // start the cron sync job
		interval: number; // sync interval in seconds
	};
}
```
#### Publish Sync Job
Sync job can be triggered inside the service using sync cron job options, but I recommend triggering from outside (crond service, K8 cronjob).

K8 CronJob example:
```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: sync-cron-job
spec:
  schedule: "*/3 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: sync-cron-job
              image: 'activatedgeek/rabbitmqadmin:0.1'
              env:
                - name: RABBIT_HOST
                  value: rabbitmq
                - name: RABBIT_PORT
                  value: '15672'
                - name: RABBIT_USER
                  value: guest
                - name: RABBIT_PASSWORD
                  value: guest
                - name: RABBIT_VHOST
                  value: '/'
              command:
                - /bin/sh
                - '-c'
              args:
                - >-
                  publish exchange=throttle routing_key=request.sync payload=" "
              imagePullPolicy: IfNotPresent
          restartPolicy: OnFailure
          terminationGracePeriodSeconds: 30
  successfulJobsHistoryLimit: 1
  failedJobsHistoryLimit: 2

```
