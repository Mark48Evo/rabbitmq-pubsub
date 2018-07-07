import { EventEmitter } from 'events';
import UUIDv4 from 'uuid/v4';
import Debug from 'debug';

const debug = Debug('rabbitmq-pubsub');

export default class RabbitMQPubSub extends EventEmitter {
  /**
   * @typedef {object} RabbitMQPubSubOptions
   * @property {string} queueNamePrefix
   * @property {string} exchangeName
   */

  /**
   * @param {Channel} channel
   * @param {RabbitMQPubSubOptions} options
   */
  constructor(channel, options) {
    super();

    this.options = options;
    this.channel = channel;
    this.consumeQueueName = `${this.options.queueNamePrefix}.${UUIDv4()}`;
  }

  async setup() {
    debug('Begin Setup');

    await this.channel.assertExchange(this.options.exchangeName, 'fanout', { durable: true });
    await this.channel.assertQueue(this.consumeQueueName, { exclusive: true });
    await this.channel.bindQueue(this.consumeQueueName, this.options.exchangeName, '');

    this.channel.consume(this.consumeQueueName, (rawMessage) => {
      const message = JSON.parse(rawMessage.content.toString());

      debug(`Received message: "${message.eventName}"`);

      this.emit(message.eventName, message.data, message);
    });

    debug('End Setup');
  }

  publish(eventName, data = {}) {
    debug(`Publishing message: "${eventName}`);

    const message = {
      eventName,
      data,
      metadata: {
        id: UUIDv4(),
        createdAt: Math.floor(Date.now() / 1000),
        processId: process.pid,
        processName: process.argv0,
      },
    };

    this.channel.publish(this.options.exchangeName, '', Buffer.from(JSON.stringify(message)));
  }
}
